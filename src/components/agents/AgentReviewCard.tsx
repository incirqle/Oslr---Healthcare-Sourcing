import { useState } from "react";
import { Check, Loader2, MapPin, ThumbsDown, ThumbsUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { OrgLogo, PersonAvatar } from "@/components/search/Avatars";
import type { DecisionRow, PoolItem, Tag } from "@/hooks/useAgents";

export function cityOf(p: Record<string, unknown>): string {
  return String(p.location ?? "").split(",")[0]?.trim() ?? "";
}

interface Props {
  item: PoolItem;
  decision?: DecisionRow;
  tags: { approve: Tag[]; pass: Tag[] };
  active?: boolean;
  draft: "approved" | "passed" | null;
  onDraft: (d: "approved" | "passed" | null) => void;
  onOpen: () => void;
  onSubmit: (b: { decision: "approved" | "passed"; tags: string[]; note?: string; skip_city?: string | null }) => Promise<void>;
}

export function AgentReviewCard({ item, decision, tags, active, draft, onDraft, onOpen, onSubmit }: Props) {
  const p = item.profile as Record<string, string | null | undefined>;
  const [picked, setPicked] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [skipCity, setSkipCity] = useState(false);
  const [busy, setBusy] = useState(false);
  const city = cityOf(item.profile);
  const tagLabel = (id: string) => [...tags.approve, ...tags.pass].find((t) => t.id === id)?.label ?? id;

  const submit = async (d: "approved" | "passed") => {
    setBusy(true);
    try {
      await onSubmit({ decision: d, tags: picked, note: note.trim() || undefined, skip_city: d === "passed" && skipCity ? city : null });
      setPicked([]); setNote(""); setSkipCity(false);
    } finally { setBusy(false); }
  };

  const options = draft === "approved" ? tags.approve : tags.pass;

  return (
    <div className={cn(
      "rounded-2xl border bg-card/80 p-4 backdrop-blur transition-all duration-300",
      active ? "border-primary/50 shadow-[0_0_0_4px_hsl(var(--primary)/0.08)]" : "border-border/70",
    )}>
      <div className="flex items-start gap-3.5">
        <button onClick={onOpen} aria-label={`Open ${p.full_name ?? ""} profile`} className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <PersonAvatar name={p.full_name ?? "?"} src={p.profile_pic_url} className="h-12 w-12" textClassName="text-sm" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={onOpen} className="truncate text-left font-display text-[16px] font-semibold tracking-tight hover:text-primary">{p.full_name}</button>
            {decision && (
              <span className={cn(
                "rounded-full px-2 py-0.5 text-[12px] font-medium",
                decision.decision === "approved" ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground",
              )}>
                {decision.decision === "approved" ? "Liked" : "Passed"}{decision.tags[0] ? `: ${tagLabel(decision.tags[0]).toLowerCase()}` : ""}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[14px] text-foreground/80">{p.title}</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted-foreground">
            {p.current_employer && (
              <span className="flex items-center gap-1.5">
                <OrgLogo name={p.current_employer} src={p.company_logo_url} fallbackSrc={p.company_domain ? `https://www.google.com/s2/favicons?domain=${p.company_domain}&sz=64` : null} className="h-4 w-4" />
                {p.current_employer}
              </span>
            )}
            {p.location && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{p.location}</span>}
          </div>
          {item.why && !decision && <p className="mt-2 text-[13px] leading-relaxed text-foreground/70">{item.why}</p>}
          {decision?.note && <p className="mt-2 border-l-2 border-primary/40 pl-3 text-[13px] italic text-foreground/80">"{decision.note}"</p>}
        </div>
        {!decision && !draft && (
          <div className="flex shrink-0 gap-1.5">
            <Button size="icon" variant="outline" className="h-10 w-10 rounded-full" aria-label={`Pass on ${p.full_name ?? ""}`} onClick={() => onDraft("passed")}><ThumbsDown className="h-4 w-4" /></Button>
            <Button size="icon" className="h-10 w-10 rounded-full" aria-label={`Approve ${p.full_name ?? ""}`} onClick={() => onDraft("approved")}><ThumbsUp className="h-4 w-4" /></Button>
          </div>
        )}
      </div>

      {!decision && draft && (
        <div className="mt-4 space-y-3 rounded-xl border border-border/60 bg-background/50 p-4 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1">
          <p className="text-[13px] font-medium">{draft === "approved" ? "What did you like? Pick any." : "Why not? Pick any."}</p>
          <div className="flex flex-wrap gap-2">
            {options.map((t) => {
              const on = picked.includes(t.id);
              return (
                <button key={t.id} onClick={() => setPicked((x) => on ? x.filter((y) => y !== t.id) : [...x, t.id])}
                  className={cn("rounded-full border px-3 py-1.5 text-[13px] transition-colors active:scale-[0.97]",
                    on ? "border-primary bg-primary/15 text-primary" : "border-border text-foreground/80 hover:border-primary/40")}>
                  {on && <Check className="mr-1 inline h-3 w-3" />}{t.label}
                </button>
              );
            })}
          </div>
          {draft === "passed" && city && (
            <label className="flex items-center gap-2 text-[13px] text-foreground/80">
              <Checkbox checked={skipCity} onCheckedChange={(v) => setSkipCity(!!v)} />
              Skip everyone in {city} from now on
            </label>
          )}
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={1000}
            placeholder="Optional note for your agent, e.g. only people who run their own practice" className="resize-none text-[14px]" />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => onDraft(null)} disabled={busy}><X className="mr-1 h-3.5 w-3.5" />Cancel</Button>
            <Button size="sm" variant={draft === "approved" ? "default" : "secondary"} onClick={() => submit(draft)} disabled={busy} className="rounded-full px-4">
              {busy && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              {draft === "approved" ? "Approve and save" : "Pass"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
