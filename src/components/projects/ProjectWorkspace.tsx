import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowUp, Bot, History, Plug, RotateCw, Search, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { useProjectSearches, useWorkspaceMembers, timeAgo } from "@/hooks/useProjectStats";
import { cn } from "@/lib/utils";
import { LiveSyncDialog } from "@/components/LiveSyncDialog";

const spring = { type: "spring" as const, bounce: 0, duration: 0.35 };

function initials(name?: string | null) {
  return (name ?? "?").split(/\s+/).map((s) => s[0]).slice(0, 2).join("").toUpperCase();
}

interface Props {
  projectId: string;
  ownerId: string | null;
  createdAt: string;
}

/** Search composer + search log (left) and the team / connections rail (right). */
export function ProjectWorkspace({ projectId, ownerId, createdAt }: Props) {
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const [q, setQ] = useState("");
  const { data: searches = [] } = useProjectSearches(projectId);
  const { data: members = [] } = useWorkspaceMembers();
  const { companyId } = useCompany();
  const { data: systems = [] } = useQuery({
    queryKey: ["workspace_integrations_rail", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await supabase.from("workspace_integrations").select("provider, provider_name, category, status").eq("company_id", companyId!);
      return data ?? [];
    },
  });
  const { data: agents = [] } = useQuery({
    queryKey: ["project_agents_rail", projectId],
    queryFn: async () => {
      const { data } = await supabase.from("clin_agents").select("id, name, status").eq("project_id", projectId);
      return data ?? [];
    },
  });

  const owner = members.find((m) => m.user_id === ownerId);
  const nameOf = (uid: string) => {
    const m = members.find((x) => x.user_id === uid);
    return m?.full_name || m?.email || "A teammate";
  };
  const run = (text: string) => {
    const v = text.trim();
    if (v) navigate(`/projects/${projectId}/search?q=${encodeURIComponent(v)}`);
  };

  const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <span className="text-[13px] text-muted-foreground">{label}</span>
      <div className="min-w-0 text-right text-[13px] font-medium text-foreground">{children}</div>
    </div>
  );

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      {/* Left: compose + history */}
      <div className="space-y-5">
        <form
          onSubmit={(e) => { e.preventDefault(); run(q); }}
          className="rounded-[20px] border border-border/70 bg-card/80 p-2 shadow-[0_18px_40px_-28px_hsl(var(--mint)/0.5)] backdrop-blur-xl transition-[border-color,box-shadow] duration-200 focus-within:border-mint/60 focus-within:shadow-[0_0_0_4px_hsl(var(--mint)/0.12)]"
        >
          <textarea
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); run(q); } }}
            rows={2}
            placeholder="Describe who you need for this role. Specialty, training, location, employer."
            className="block w-full resize-none bg-transparent px-4 pb-1 pt-3 text-[15px] leading-relaxed text-foreground placeholder:text-muted-foreground/70 focus:outline-none"
          />
          <div className="flex items-center justify-between px-2 pb-1">
            <div className="flex gap-1">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-mint/10 px-3 py-1.5 text-xs font-semibold text-mint-ink">
                <Search className="h-3.5 w-3.5" /> Search
              </span>
              <button
                type="button"
                onClick={() => navigate("/agents")}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground"
              >
                <Bot className="h-3.5 w-3.5" /> Agent
              </button>
            </div>
            <button
              type="submit"
              aria-label="Run search"
              disabled={!q.trim()}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-mint text-mint-foreground transition-[transform,background-color,opacity] duration-100 ease-out hover:bg-mint-ink active:scale-[0.94] disabled:opacity-30"
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          </div>
        </form>

        <section className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-sm">
          <header className="flex items-center justify-between border-b border-border/50 px-5 py-3.5">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <History className="h-4 w-4 text-mint-ink" /> Searches
              <span className="tabular-nums text-muted-foreground">{searches.length}</span>
            </h2>
          </header>
          {searches.length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted-foreground">No searches yet. Describe who you need above.</p>
          ) : (
            <ul className="max-h-[300px] overflow-y-auto">
              {searches.map((s, i) => (
                <motion.li
                  key={s.id}
                  initial={{ opacity: 0, transform: reduce ? "none" : "translateY(4px)" }}
                  animate={{ opacity: 1, transform: "translateY(0px)" }}
                  transition={{ ...spring, delay: Math.min(i, 6) * 0.04 }}
                >
                  <button
                    onClick={() => run(s.query)}
                    className="group flex w-full items-center gap-3 border-b border-border/40 px-5 py-3 text-left transition-colors duration-150 last:border-b-0 hover:bg-mint/[0.04] active:bg-mint/[0.08]"
                  >
                    <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">{s.query}</span>
                      <span className="block text-xs text-muted-foreground">
                        {s.resultCount.toLocaleString()} matches · {timeAgo(s.createdAt)} by {nameOf(s.userId)}
                      </span>
                    </span>
                    <RotateCw className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40 transition-colors group-hover:text-mint-ink" />
                  </button>
                </motion.li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Right rail */}
      <aside className="space-y-4">
        <section className="rounded-2xl border border-border/60 bg-card/60 px-5 py-3 backdrop-blur-sm">
          <h3 className="pb-1 pt-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Team</h3>
          <div className="divide-y divide-border/40">
            <Row label="Owner">
              <span className="inline-flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-mint/15 text-[10px] font-semibold text-mint-ink">{initials(owner?.full_name ?? owner?.email)}</span>
                <span className="truncate">{owner?.full_name || owner?.email || "You"}</span>
              </span>
            </Row>
            <Row label="Shared with">
              <span className="inline-flex items-center gap-2">
                <span className="flex -space-x-1.5">
                  {members.slice(0, 4).map((m) => (
                    <span key={m.user_id} title={m.full_name ?? m.email ?? ""} className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-card bg-mint/15 text-[10px] font-semibold text-mint-ink">
                      {initials(m.full_name ?? m.email)}
                    </span>
                  ))}
                </span>
                <span className="text-muted-foreground">Workspace</span>
              </span>
            </Row>
            <Row label="Invite">
              <button onClick={() => navigate("/settings")} className="inline-flex items-center gap-1 text-mint-ink hover:underline">
                <Users className="h-3.5 w-3.5" /> Add teammates
              </button>
            </Row>
            <Row label="Created">{new Date(createdAt).toLocaleDateString()}</Row>
          </div>
        </section>

        <section className="rounded-2xl border border-border/60 bg-card/60 px-5 py-3 backdrop-blur-sm">
          <h3 className="pb-1 pt-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Connections</h3>
          <div className="divide-y divide-border/40">
            <Row label="Live sync">
              <LiveSyncDialog projectId={projectId} />
            </Row>
            {systems.length > 0 ? systems.map((s) => (
              <Row key={s.provider} label={s.category === "crm" ? "CRM" : "ATS"}>
                <span className="inline-flex items-center gap-1.5">
                  <span className={cn("h-1.5 w-1.5 rounded-full", s.status === "connected" ? "bg-mint" : "bg-muted-foreground/50")} />
                  {s.provider_name ?? s.provider}
                </span>
              </Row>
            )) : (
              <Row label="ATS / CRM">
                <button onClick={() => navigate("/integrations")} className="inline-flex items-center gap-1 text-mint-ink hover:underline">
                  <Plug className="h-3.5 w-3.5" /> Connect
                </button>
              </Row>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-border/60 bg-card/60 px-5 py-3 backdrop-blur-sm">
          <h3 className="pb-1 pt-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Agents</h3>
          {agents.length === 0 ? (
            <button
              onClick={() => navigate("/agents")}
              className="my-2 flex w-full items-center gap-2 rounded-xl border border-dashed border-mint/40 px-3 py-2.5 text-[13px] font-medium text-mint-ink transition-colors duration-150 hover:bg-mint/[0.06]"
            >
              <Bot className="h-4 w-4" /> Put an agent on this role
            </button>
          ) : (
            <div className="divide-y divide-border/40">
              {agents.map((a) => (
                <button key={a.id} onClick={() => navigate(`/agents/${a.id}`)} className="flex w-full items-center justify-between py-2.5 text-left text-[13px]">
                  <span className="truncate font-medium text-foreground">{a.name}</span>
                  <span className="capitalize text-muted-foreground">{a.status}</span>
                </button>
              ))}
            </div>
          )}
        </section>
      </aside>
    </div>
  );
}
