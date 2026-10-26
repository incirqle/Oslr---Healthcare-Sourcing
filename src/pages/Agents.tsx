import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { useAgents, useAgentsEnabled, type AgentRow } from "@/hooks/useAgents";
import { AgentsLocked, AgentSteps } from "@/components/agents/AgentsLocked";
import { AgentCard } from "@/components/agents/AgentCard";
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
              <h1 className="font-display text-3xl font-bold tracking-tight">Agents</h1>
              <p className="mt-1 text-[15px] text-muted-foreground">Your own researchers, finding clinicians while you sleep.</p>
            </div>
            <Button onClick={() => setOpen(true)} className="h-11 rounded-full px-5"><Plus className="mr-1.5 h-4 w-4" />Start a new agent</Button>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : agents.length === 0 ? (
            <div className="relative overflow-hidden rounded-3xl border border-border/70 bg-card p-8">
              <div className="pointer-events-none absolute -left-16 -top-24 h-72 w-72 rounded-full bg-primary/15 blur-3xl" />
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
