import { useEffect, useState } from "react";
import { Moon } from "lucide-react";

/** Live clock to the next overnight search. */
export function AgentCountdown({ at, label = "Next search in" }: { at: string | null; label?: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), 30_000); return () => window.clearInterval(t); }, []);
  if (!at) return null;
  const ms = new Date(at).getTime() - now;
  if (Number.isNaN(ms)) return null;
  const mins = Math.max(0, Math.round(ms / 60000));
  const text = ms <= 0 ? "any minute now" : mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h ${mins % 60}m`;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border agent-sheen-border agent-sheen px-3 py-1 text-[12px] font-medium text-foreground/80">
      <Moon className="h-3.5 w-3.5 text-primary-glow agent-spark" />
      {label} <span className="tabular-nums font-semibold text-foreground">{text}</span>
    </span>
  );
}
