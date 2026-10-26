import { Lock, MessageSquareText, Moon, Sunrise } from "lucide-react";

const STEPS = [
  { icon: MessageSquareText, title: "Tell it who you want", body: "Describe the clinicians, specialty, and area you have in mind." },
  { icon: Moon, title: "It searches overnight", body: "Your agent looks for people who match the direction you approved." },
  { icon: Sunrise, title: "Check your morning list", body: "Review new matches. Your yeses, passes, and reasons shape the next list." },
];

export function AgentSteps() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {STEPS.map((s, i) => (
        <div key={s.title} className="rounded-2xl border border-border/70 bg-card/70 p-5 backdrop-blur transition-transform duration-300 motion-safe:hover:-translate-y-0.5">
          <div className="flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary"><s.icon className="h-5 w-5" /></div>
            <span className="text-[12px] text-muted-foreground">Step {i + 1}</span>
          </div>
          <h3 className="mt-4 font-display text-[17px] font-semibold tracking-tight">{s.title}</h3>
          <p className="mt-1.5 text-[14px] leading-relaxed text-muted-foreground">{s.body}</p>
        </div>
      ))}
    </div>
  );
}

export function AgentsLocked() {
  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl border border-border/70 bg-card p-8">
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-primary/15 blur-3xl" />
        <div className="relative max-w-xl">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[12px] font-medium text-primary">
            <Lock className="h-3 w-3" /> Premium
          </span>
          <h1 className="mt-4 font-display text-3xl font-bold tracking-tight">Your own researcher, working every night.</h1>
          <p className="mt-2 text-[15px] text-muted-foreground">
            Agents learn what a great fit looks like for you and bring fresh clinicians every morning. Agents are part of our premium plan. Talk to us to turn them on for your team.
          </p>
        </div>
      </div>
      <AgentSteps />
    </div>
  );
}
