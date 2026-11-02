import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { useAuth } from "@/hooks/useAuth";

export interface ProjectStat {
  total: number;
  contacted: number;
  interested: number;
  hired: number;
  searches: number;
  lastSearchAt: number | null;
  agentStatus: string | null;
}

const empty = (): ProjectStat => ({
  total: 0, contacted: 0, interested: 0, hired: 0, searches: 0, lastSearchAt: null, agentStatus: null,
});

/** Pipeline, search and agent counts for every project in the workspace. Read-only, no provider calls. */
export function useProjectStats() {
  const { companyId } = useCompany();
  const { user } = useAuth();
  return useQuery({
    queryKey: ["project_stats", companyId, user?.id],
    enabled: !!companyId,
    queryFn: async () => {
      const [cand, hist, agents] = await Promise.all([
        supabase.from("candidates").select("project_id, status").eq("company_id", companyId!),
        supabase.from("search_history").select("search_params, created_at").eq("company_id", companyId!).order("created_at", { ascending: false }).limit(1000),
        supabase.from("clin_agents").select("project_id, status").eq("company_id", companyId!),
      ]);
      const stats: Record<string, ProjectStat> = {};
      const get = (id: string) => (stats[id] ??= empty());
      for (const r of cand.data ?? []) {
        const s = get(r.project_id);
        s.total++;
        if (r.status === "contacted") s.contacted++;
        if (r.status === "interested") s.interested++;
        if (r.status === "hired") s.hired++;
      }
      for (const r of hist.data ?? []) {
        const pid = (r.search_params as { project_id?: string } | null)?.project_id;
        if (!pid) continue;
        const s = get(pid);
        s.searches++;
        const t = new Date(r.created_at).getTime();
        if (!s.lastSearchAt || t > s.lastSearchAt) s.lastSearchAt = t;
      }
      for (const r of agents.data ?? []) {
        if (!r.project_id) continue;
        const s = get(r.project_id);
        const live = r.status === "sourcing" || r.status === "calibrating";
        if (live || !s.agentStatus) s.agentStatus = r.status;
      }
      return stats;
    },
  });
}

export interface ProjectSearch {
  id: string;
  query: string;
  resultCount: number;
  createdAt: number;
  userId: string;
}

/** Every search run inside one project, newest first. */
export function useProjectSearches(projectId: string) {
  const { companyId } = useCompany();
  return useQuery({
    queryKey: ["project_searches", projectId, companyId],
    enabled: !!projectId && !!companyId,
    queryFn: async (): Promise<ProjectSearch[]> => {
      const { data } = await supabase
        .from("search_history")
        .select("id, query_text, result_count, created_at, user_id, search_params")
        .eq("company_id", companyId!)
        .filter("search_params->>project_id", "eq", projectId)
        .order("created_at", { ascending: false })
        .limit(50);
      const seen = new Set<string>();
      return (data ?? [])
        .filter((r) => {
          const k = r.query_text.toLowerCase();
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        })
        .map((r) => ({
          id: r.id, query: r.query_text, resultCount: r.result_count ?? 0,
          createdAt: new Date(r.created_at).getTime(), userId: r.user_id,
        }));
    },
  });
}

/** Workspace members, for owner and team display. */
export function useWorkspaceMembers() {
  const { companyId } = useCompany();
  return useQuery({
    queryKey: ["workspace_members", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, full_name, email, avatar_url").eq("company_id", companyId!);
      return data ?? [];
    },
  });
}

export function timeAgo(ts: number): string {
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}

/** Turns a typed search into a short project name. */
export function projectNameFromQuery(q: string): string {
  const clean = q.trim().replace(/\s+/g, " ").replace(/[."']+$/g, "");
  const cased = clean.charAt(0).toUpperCase() + clean.slice(1);
  return cased.length > 60 ? cased.slice(0, 57).trimEnd() + "…" : cased;
}
