import { cn } from "@/lib/utils";
import type { AgentStatus } from "@/hooks/useAgents";

export const STATUS_LABEL: Record<AgentStatus, string> = {
  calibrating: "Learning your taste",
  sourcing: "Working",
  paused: "Paused",
  completed: "Goal reached",
  closed: "Closed",
};

export function AgentStatusDot({ status, waiting = 0, className }: { status: AgentStatus; waiting?: number; className?: string }) {
  const live = status === "sourcing" || status === "calibrating";
  return (
    <span className={cn("relative inline-flex h-2.5 w-2.5", className)}>
      {live && waiting > 0 && <span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-60 motion-safe:animate-ping" />}
      <span className={cn(
        "relative inline-flex h-2.5 w-2.5 rounded-full",
        live ? "bg-primary" : status === "paused" ? "bg-accent-foreground/50" : "bg-muted-foreground/50",
      )} />
    </span>
  );
}

export function GoalRing({ value, max, size = 40 }: { value: number; max: number | null; size?: number }) {
  const pct = max ? Math.min(1, value / max) : 0;
  const r = (size - 5) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} className="-rotate-90" aria-label={max ? `${value} of ${max} saved` : `${value} saved`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--border))" strokeWidth={4} />
      {max ? (
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--primary))" strokeWidth={4} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)} className="transition-[stroke-dashoffset] duration-700 ease-out" />
      ) : null}
    </svg>
  );
}
