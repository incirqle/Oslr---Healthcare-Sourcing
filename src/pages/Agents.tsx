import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { useAgentMetering, useAgents, useAgentsEnabled, type AgentRow } from "@/hooks/useAgents";
import { AgentsLocked, AgentSteps } from "@/components/agents/AgentsLocked";
import { AgentCard } from "@/components/agents/AgentCard";
import { AgentCountdown } from "@/components/agents/AgentCountdown";
import { AgentBriefDialog } from "@/components/agents/AgentBriefDialog";

const GROUPS: { title: string; test: (a: AgentRow) => boolean }[] = [
  { title: "Ready for you", test: (a) => (a.stats?.waiting ?? 0) > 0 },
  { title: "Working", test: (a) => (a.stats?.waiting ?? 0) === 0 && (a.status === "sourcing" || a.status === "calibrating") },
  { title: "Needs attention", test: (a) => a.status === "paused" },
  { title: "Resting", test: (a) => a.status === "completed" },
];

export default function Agents() {
  const { data: enabled, isLoading: el } = useAgentsEnabled();
  const { data: agents = [], isLoading } = useAgents(!!enabled);
  const [open, setOpen] = useState(false);
  const { data: metering } = useAgentMetering(!!enabled);
  const waiting = agents.reduce((n, a) => n + (a.stats?.waiting ?? 0), 0);
  const saved = agents.reduce((n, a) => n + (a.stats?.approved ?? 0), 0);
  const next = agents.filter((a) => a.status === "sourcing" && a.next_run_at).map((a) => a.next_run_at as string).sort()[0] ?? null;

  return (
    <AppLayout>
      {el ? (
        <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : !enabled ? (
        <AgentsLocked />
      ) : (
        <div className="space-y-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="font-display text-3xl font-bold tracking-tight">Agents{metering && <span className="ml-3 align-middle rounded-full border agent-sheen-border agent-sheen px-2.5 py-0.5 text-[12px] font-medium text-foreground/80 tabular-nums">{metering.active}{metering.limit !== null ? ` / ${metering.limit}` : ""} active</span>}</h1>
              <p className="mt-1 text-[15px] text-muted-foreground">Your own researchers, finding clinicians while you sleep.</p>
            </div>
            <Button onClick={() => setOpen(true)} className="h-11 rounded-full px-5"><Plus className="mr-1.5 h-4 w-4" />Start a new agent</Button>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : agents.length > 0 ? (
            <>
            <div className="agent-glow agent-enter grid gap-3 rounded-3xl border agent-sheen-border bg-card/80 p-5 sm:grid-cols-3">
              <div><p className="text-[12px] uppercase tracking-wider text-muted-foreground">Waiting for you</p><p className="mt-1 font-display text-3xl font-bold tabular-nums">{waiting}</p><p className="text-[13px] text-muted-foreground">fresh clinicians to review</p></div>
              <div><p className="text-[12px] uppercase tracking-wider text-muted-foreground">Saved so far</p><p className="mt-1 font-display text-3xl font-bold tabular-nums">{saved}</p><p className="text-[13px] text-muted-foreground">approved across all agents</p></div>
              <div className="flex flex-col justify-center gap-2">{next ? <AgentCountdown at={next} label="Next overnight search in" /> : <p className="text-[13px] text-muted-foreground">Review first matches to start nightly searches.</p>}</div>
            </div>
            {GROUPS.map((g) => {
              const list = agents.filter(g.test);
              if (list.length === 0) return null;
              return (
                <section key={g.title} className="space-y-3">
                  <h2 className="text-[13px] font-semibold uppercase tracking-wider text-muted-foreground">{g.title} <span className="ml-1 tabular-nums">{list.length}</span></h2>
                  <div className="grid gap-3 md:grid-cols-2">{list.map((a) => <AgentCard key={a.id} agent={a} />)}</div>
                </section>
              );
            })}
            </>
          ) : (
            <div className="agent-glow relative rounded-3xl border agent-sheen-border bg-card/80 p-8">
              <div className="relative">
                <h2 className="font-display text-2xl font-bold tracking-tight">Your own researcher, working every night.</h2>
                <p className="mt-1.5 text-[15px] text-muted-foreground">Tell your agent who you are looking for. Review its first matches, then come back to fresh people each morning.</p>
                <div className="mt-6"><AgentSteps /></div>
                <Button onClick={() => setOpen(true)} className="mt-6 h-11 rounded-full px-5"><Plus className="mr-1.5 h-4 w-4" />Start a new agent</Button>
              </div>
            </div>
          ) : (
            GROUPS.map((g) => {
              const list = agents.filter(g.test);
              if (list.length === 0) return null;
              return (
                <section key={g.title} className="space-y-3">
                  <h2 className="text-[13px] font-semibold uppercase tracking-wider text-muted-foreground">{g.title} <span className="ml-1 tabular-nums">{list.length}</span></h2>
                  <div className="grid gap-3 md:grid-cols-2">{list.map((a) => <AgentCard key={a.id} agent={a} />)}</div>
                </section>
              );
            })
          )}
        </div>
      )}
      <AgentBriefDialog open={open} onOpenChange={setOpen} />
    </AppLayout>
  );
}
