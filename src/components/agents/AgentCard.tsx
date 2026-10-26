import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { AgentStatusDot, GoalRing, STATUS_LABEL } from "./AgentStatusDot";
import { fmtWhen, type AgentRow } from "@/hooks/useAgents";

export function AgentCard({ agent }: { agent: AgentRow }) {
  const s = agent.stats ?? { waiting: 0, approved: 0, passed: 0 };
  return (
    <Link
      to={`/agents/${agent.id}`}
      className="group flex items-center gap-4 rounded-2xl border border-border/70 bg-card/80 p-4 backdrop-blur transition-all duration-200 hover:border-primary/40 hover:bg-card active:scale-[0.99]"
    >
      <div className="relative flex items-center justify-center">
        <GoalRing value={s.approved} max={agent.goal} size={44} />
        <span className="absolute text-[12px] font-semibold tabular-nums">{s.approved}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <AgentStatusDot status={agent.status} waiting={s.waiting} />
          <p className="truncate font-display text-[16px] font-semibold tracking-tight">{agent.name}</p>
        </div>
        <p className="mt-0.5 truncate text-[13px] text-muted-foreground">
          {s.waiting > 0
            ? `${s.waiting} waiting for you`
            : agent.status === "paused"
            ? agent.pause_reason ?? "Paused"
            : agent.status === "sourcing"
            ? `Caught up. Next search ${fmtWhen(agent.next_run_at)}`
            : STATUS_LABEL[agent.status]}
        </p>
      </div>
      {s.waiting > 0 && (
        <span className="rounded-full bg-primary px-2.5 py-0.5 text-[12px] font-semibold text-primary-foreground tabular-nums">{s.waiting}</span>
      )}
      <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
