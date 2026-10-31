import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";

export type AgentStatus = "calibrating" | "sourcing" | "paused" | "completed" | "closed";

export interface AgentRow {
  id: string;
  project_id: string | null;
  name: string;
  brief: string;
  status: AgentStatus;
  per_day: number;
  goal: number | null;
  finish_date: string | null;
  timezone: string;
  next_run_at: string | null;
  last_run_at: string | null;
  taste_memo: string | null;
  email_updates: boolean;
  pause_reason: string | null;
  preferences: { weights: Record<string, number>; skip: { cities: string[]; employers: string[] } };
  created_at: string;
  stats?: { waiting: number; approved: number; passed: number };
}

export interface PoolItem {
  id: string;
  person_id: string;
  profile: Record<string, unknown>;
  features: string[];
  why: string | null;
  final_score: number;
  served_at: string | null;
  decision: "approved" | "passed" | null;
  decided_at: string | null;
  pruned: boolean;
}

export interface DecisionRow {
  pool_id: string;
  decision: "approved" | "passed";
  tags: string[];
  note: string | null;
  skip_city: string | null;
  created_at: string;
}

export interface AgentEvent { event_type: string; payload: Record<string, unknown>; created_at: string }
export interface Tag { id: string; label: string }

export interface Roster {
  agent: AgentRow;
  pool: PoolItem[];
  decisions: DecisionRow[];
  events: AgentEvent[];
  signals: { feature: string; share: number }[];
  reserve: number;
  tags: { approve: Tag[]; pass: Tag[] };
}

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("clinician-agent", { body });
  if (error) {
    let msg = "Something went wrong.";
    try {
      const ctx = (error as { context?: Response }).context;
      const j = ctx ? await ctx.json() : null;
      if (j?.error) msg = j.error;
    } catch { /* keep default */ }
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  return data as T;
}

/** Agents are a per-team premium switch, read from the backend. */
export function useAgentsEnabled() {
  const { companyId } = useCompany();
  return useQuery({
    queryKey: ["agents-enabled", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      if (!companyId) return false;
      const { data } = await supabase.from("company_features").select("agents_enabled, plan").eq("company_id", companyId).maybeSingle();
      return !!data?.agents_enabled || ["starter", "pro", "enterprise"].includes(data?.plan ?? "");
    },
    staleTime: 60_000,
  });
}

export function useAgents(enabled = true) {
  return useQuery({
    queryKey: ["agents"],
    enabled,
    queryFn: () => call<{ agents: AgentRow[] }>({ action: "list" }).then((r) => r.agents),
    refetchInterval: 60_000,
  });
}

export function useRoster(agentId: string | undefined) {
  return useQuery({
    queryKey: ["agent-roster", agentId],
    enabled: !!agentId,
    queryFn: () => call<Roster>({ action: "roster", agent_id: agentId }),
    refetchInterval: 60_000,
  });
}

export function useCreateAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: { request_id: string; name: string; brief: string; per_day: number; goal?: number | null; finish_date?: string | null; project_id?: string | null }) =>
      call<{ agent_id: string; served?: number; warning?: string }>({
        action: "create", ...b, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["agents"] }); qc.invalidateQueries({ queryKey: ["agent-metering"] }); qc.invalidateQueries({ queryKey: ["projects"] }); window.dispatchEvent(new Event("oslr:credits")); },
  });
}

export function useAgentMetering(enabled: boolean) {
  const { companyId } = useCompany();
  return useQuery({
    queryKey: ["agent-metering", companyId], enabled: enabled && !!companyId,
    queryFn: () => call<{ metering: { limit: number | null; scope: "workspace" | "user"; active: number; build_credits: number } }>({ action: "list" }).then((r) => r.metering),
    refetchInterval: 60_000,
  });
}

export function useDecide(agentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: { pool_id: string; decision: "approved" | "passed"; tags: string[]; note?: string; skip_city?: string | null }) =>
      call<{ ok: true; status: AgentStatus }>({ action: "decide", agent_id: agentId, ...b }),
    onMutate: async (b) => {
      await qc.cancelQueries({ queryKey: ["agent-roster", agentId] });
      const prev = qc.getQueryData<Roster>(["agent-roster", agentId]);
      if (prev) {
        qc.setQueryData<Roster>(["agent-roster", agentId], {
          ...prev,
          pool: prev.pool.map((p) => (p.id === b.pool_id ? { ...p, decision: b.decision, decided_at: new Date().toISOString() } : p)),
          decisions: [{ pool_id: b.pool_id, decision: b.decision, tags: b.tags, note: b.note ?? null, skip_city: b.skip_city ?? null, created_at: new Date().toISOString() }, ...prev.decisions],
        });
      }
      return { prev };
    },
    onError: (_e, _b, ctx) => { if (ctx?.prev) qc.setQueryData(["agent-roster", agentId], ctx.prev); },
    onSettled: () => { qc.invalidateQueries({ queryKey: ["agent-roster", agentId] }); qc.invalidateQueries({ queryKey: ["agents"] }); qc.invalidateQueries({ queryKey: ["agent-metering"] }); },
  });
}

export function useSteer(agentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (message: string) => call<{ reply: string }>({ action: "steer", agent_id: agentId, message }),
    onSettled: () => qc.invalidateQueries({ queryKey: ["agent-roster", agentId] }),
  });
}

export function useUpdateAgent(agentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: Record<string, unknown>) => call<{ ok: true }>({ action: "update", agent_id: agentId, ...b }),
    onSettled: () => { qc.invalidateQueries({ queryKey: ["agent-roster", agentId] }); qc.invalidateQueries({ queryKey: ["agents"] }); qc.invalidateQueries({ queryKey: ["agent-metering"] }); },
  });
}

/** Plain-words label for a learned feature key. */
export function featureLabel(f: string): string {
  const [k, v = ""] = f.split(":");
  const cap = v.replace(/\b\w/g, (c) => c.toUpperCase());
  if (k === "role") return ({ owner: "Practice owner or partner", leadership: "Leadership role", trainee: "In training", clinician: "Practicing clinician" } as Record<string, string>)[v] ?? cap;
  if (k === "setting") return ({ academic: "Academic setting", hospital: "Hospital or health system", private: "Private practice" } as Record<string, string>)[v] ?? cap;
  if (k === "city") return `Lives in ${cap}`;
  if (k === "state") return `In ${cap}`;
  if (k === "employer") return `Works at ${cap}`;
  return cap;
}

export function fmtWhen(iso: string | null | undefined): string {
  if (!iso) return "Not scheduled";
  const d = new Date(iso);
  return d.toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
