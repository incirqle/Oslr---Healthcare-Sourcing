import { useState } from "react";
import { Link } from "react-router-dom";
import { Bot, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAgents, useAgentsEnabled } from "@/hooks/useAgents";
import { AgentCard } from "./AgentCard";
import { AgentBriefDialog } from "./AgentBriefDialog";

/** Active agents on the Dashboard (all) or a Project (filtered). Hidden for teams without Agents. */
export function ActiveAgentsStrip({ projectId }: { projectId?: string }) {
  const { data: enabled } = useAgentsEnabled();
  const { data: agents = [] } = useAgents(!!enabled);
  const [open, setOpen] = useState(false);
  if (!enabled) return null;
  const list = projectId ? agents.filter((a) => a.project_id === projectId) : agents;

  return (
    <section className="rounded-2xl border border-border/70 bg-card/60 p-5 backdrop-blur">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-primary" />
          <h2 className="font-display text-lg font-semibold tracking-tight">Active agents</h2>
        </div>
        <div className="flex items-center gap-2">
          {!projectId && list.length > 0 && <Button asChild variant="ghost" size="sm"><Link to="/agents">See all</Link></Button>}
          <Button size="sm" variant="outline" className="rounded-full" onClick={() => setOpen(true)}><Plus className="mr-1 h-3.5 w-3.5" />New agent</Button>
        </div>
      </div>
      {list.length === 0 ? (
        <p className="py-4 text-[14px] text-muted-foreground">
          {projectId ? "No agent is working on this project yet. Start one and it brings fresh matches every morning." : "No agents yet. Start one and it brings fresh matches every morning."}
        </p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">{list.slice(0, 4).map((a) => <AgentCard key={a.id} agent={a} />)}</div>
      )}
      <AgentBriefDialog open={open} onOpenChange={setOpen} defaultProjectId={projectId} />
    </section>
  );
}
