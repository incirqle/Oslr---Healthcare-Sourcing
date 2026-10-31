import { Briefcase, Building2, MapPin, Sparkles } from "lucide-react";
import type { PoolItem } from "@/hooks/useAgents";

const ROLE: Record<string, string> = { trainee: "In training", owner: "Owns or leads a practice", leadership: "In a leadership role", clinician: "Practicing clinician" };
const SETTING: Record<string, string> = { academic: "Academic setting", hospital: "Hospital or health system", private: "Private practice" };

/** "Why this match": plain facts the agent used to pick this person. */
export function MatchFacts({ item }: { item: PoolItem }) {
  const p = item.profile as Record<string, unknown>;
  const f = item.features ?? [];
  const get = (k: string) => f.find((x) => x.startsWith(k + ":"))?.slice(k.length + 1);
  const facts = [
    { icon: Briefcase, text: ROLE[get("role") ?? ""] },
    { icon: Building2, text: SETTING[get("setting") ?? ""] },
    { icon: MapPin, text: typeof p.location === "string" ? p.location : undefined },
  ].filter((x): x is { icon: typeof Briefcase; text: string } => !!x.text);
  const fit = item.final_score >= 0.75 ? "Strong match" : item.final_score >= 0.5 ? "Good match" : "Possible match";
  if (!facts.length) return null;
  return (
    <div className="mt-3 rounded-xl agent-sheen border agent-sheen-border px-3 py-2.5">
      <div className="mb-1.5 flex items-center justify-between">
        <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-mint-ink"><Sparkles className="h-3 w-3 text-mint" />Why this match</p>
        <span className="rounded-full bg-card/80 px-2 py-0.5 text-[11px] font-medium text-foreground/70">{fit}</span>
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1">
        {facts.map((x) => <li key={x.text} className="flex items-center gap-1.5 text-[13px] text-foreground/80"><x.icon className="h-3.5 w-3.5 text-mint" />{x.text}</li>)}
      </ul>
    </div>
  );
}
