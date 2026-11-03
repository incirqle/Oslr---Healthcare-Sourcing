import { useEffect, useMemo, useState } from "react";
import { Briefcase, Check, ChevronLeft, ChevronRight, Clock, ExternalLink, GraduationCap, Loader2, MapPin, Sparkles, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { OrgLogo, PersonAvatar } from "@/components/search/Avatars";
import { DoctorIntelTab } from "@/components/DoctorIntelTab";
import { normalizeEducation, normalizeExperience, type CandidateDrawerProps } from "@/components/CandidateDrawer";
import { MatchFacts } from "./MatchFacts";
import { ContactEnrichPanel } from "@/components/ContactEnrichPanel";
import { useContactEnrich } from "@/hooks/useContactEnrich";
import { toast } from "sonner";
import { cityOf } from "./AgentReviewCard";
import { cn } from "@/lib/utils";
import type { DecisionRow, PoolItem, Tag } from "@/hooks/useAgents";

type Cand = NonNullable<CandidateDrawerProps["candidate"]>;
type Section = "experience" | "education" | "industry";

const yr = (s: string | null) => (s ? s.slice(0, 4) : "");
const favicon = (d: string | null) => (d ? `https://www.google.com/s2/favicons?domain=${d}&sz=128` : null);

interface Props {
  item: PoolItem | null;
  candidate: Cand | null;
  decision?: DecisionRow;
  tags: { approve: Tag[]; pass: Tag[] };
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
  onSubmit: (b: { decision: "approved" | "passed"; tags: string[]; note?: string; skip_city?: string | null }) => Promise<void>;
}

/** Abbreviated clinician card for agent review: who they are, experience, education, industry ties, and the decision. */
export function AgentProfileDialog({ item, candidate, decision, tags, hasPrev, hasNext, onPrev, onNext, onClose, onSubmit }: Props) {
  const [choice, setChoice] = useState<"approved" | "passed">("approved");
  const [picked, setPicked] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [skipCity, setSkipCity] = useState(false);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<Record<Section, boolean>>({ experience: true, education: true, industry: false });
  const [showAllExp, setShowAllExp] = useState(false);
  const [readMore, setReadMore] = useState(false);

  useEffect(() => { setChoice("approved"); setPicked([]); setNote(""); setSkipCity(false); setShowAllExp(false); setReadMore(false); }, [item?.id]);

  const pp = (item?.profile ?? {}) as Record<string, string | null | undefined>;
  const contactEnrich = useContactEnrich(pp.linkedin_url ?? null, pp.full_name ?? undefined);
  const exp = useMemo(() => (candidate ? normalizeExperience(candidate, null) : []), [candidate]);
  const edu = useMemo(() => (candidate ? normalizeEducation(candidate, null) : []), [candidate]);
  if (!item || !candidate) return null;

  const p = item.profile as Record<string, string | null | undefined>;
  const city = cityOf(item.profile);
  const options = choice === "approved" ? tags.approve : tags.pass;
  const shownExp = showAllExp ? exp : exp.slice(0, 4);
  const summary = candidate.summary ?? "";

  const submit = async (d: "approved" | "passed") => {
    setBusy(true);
    try {
      await onSubmit({ decision: d, tags: picked, note: note.trim() || undefined, skip_city: d === "passed" && skipCity ? city : null });
    } finally { setBusy(false); }
  };

  const Head = ({ id, icon: Icon, label, count }: { id: Section; icon: typeof Briefcase; label: string; count?: number }) => (
    <button onClick={() => setOpen((o) => ({ ...o, [id]: !o[id] }))} aria-expanded={open[id]}
      className="flex w-full items-center gap-2 py-1 text-left text-[12px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground">
      <Icon className="h-3.5 w-3.5 text-mint" />{label}{count ? <span className="font-normal normal-case tracking-normal">({count})</span> : null}
      <ChevronRight className={cn("ml-auto h-4 w-4 transition-transform duration-200", open[id] && "rotate-90")} />
    </button>
  );

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex h-[min(92dvh,860px)] max-w-6xl flex-col gap-0 overflow-hidden p-0 [&>button]:hidden">
        <DialogTitle className="sr-only">{p.full_name} profile</DialogTitle>
        <div className="flex items-center justify-between border-b border-border/70 px-5 py-3">
          <p className="font-display text-[15px] font-semibold">Profile</p>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" aria-label="Previous person" disabled={!hasPrev} onClick={onPrev}><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" aria-label="Next person" disabled={!hasNext} onClick={onNext}><ChevronRight className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" aria-label="Close" onClick={onClose}><X className="h-4 w-4" /></Button>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 md:grid-cols-[minmax(0,1fr)_360px]">
          {/* Left: who they are */}
          <div className="min-h-0 overflow-y-auto">
            <div className="agent-glow border-b border-border/60 px-6 py-6">
              <div className="flex items-start gap-4">
                <PersonAvatar name={p.full_name ?? "?"} src={p.profile_pic_url} className="h-20 w-20" textClassName="text-xl" />
                <div className="min-w-0">
                  <h2 className="font-display text-2xl font-semibold tracking-tight">{p.full_name}</h2>
                  {p.title && <p className="mt-0.5 text-[15px] text-foreground/80">{p.title}</p>}
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted-foreground">
                    {p.current_employer && <span className="flex items-center gap-1.5"><OrgLogo name={p.current_employer} src={p.company_logo_url} fallbackSrc={favicon(p.company_domain ?? null)} className="h-4 w-4" />{p.current_employer}</span>}
                    {p.location && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{p.location}</span>}
                    {p.linkedin_url && <a href={p.linkedin_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[11px] font-medium hover:text-foreground">in<ExternalLink className="h-3 w-3" /></a>}
                  </div>
                </div>
              </div>
              {summary && (
                <div className="mt-5">
                  <p className="flex items-center gap-1.5 text-[13px] font-semibold"><Sparkles className="h-3.5 w-3.5 text-mint" />Summary</p>
                  <p className={cn("mt-1.5 text-[14px] leading-relaxed text-foreground/80", !readMore && "line-clamp-3")}>{summary}</p>
                  {summary.length > 220 && <button className="mt-1 text-[13px] font-medium text-mint-ink hover:underline" onClick={() => setReadMore((v) => !v)}>{readMore ? "Show less" : "Read more"}</button>}
                </div>
              )}
            </div>

            <div className="space-y-5 px-6 py-5">
              <section>
                <Head id="experience" icon={Briefcase} label="Experience" count={exp.length} />
                {open.experience && (exp.length === 0 ? <p className="py-2 text-[13px] text-muted-foreground">No experience listed.</p> : (
                  <ol className="mt-2 space-y-3">
                    {shownExp.map((e, i) => (
                      <li key={i} className="flex gap-3">
                        <OrgLogo name={e.company ?? "?"} src={e.logoUrl} fallbackSrc={favicon(e.logoDomain)} className="h-10 w-10 rounded-lg" />
                        <div className="min-w-0">
                          <p className="text-[14px] font-medium">{e.title ?? "Role"}</p>
                          <p className="text-[13px] text-muted-foreground">{e.company}</p>
                          {(e.startDate || e.endDate) && <p className="flex items-center gap-1 text-[12px] text-muted-foreground"><Clock className="h-3 w-3" />{yr(e.startDate)} to {e.isCurrent && !e.endDate ? "Present" : yr(e.endDate)}</p>}
                        </div>
                      </li>
                    ))}
                    {exp.length > 4 && <button className="text-[13px] font-medium text-mint-ink hover:underline" onClick={() => setShowAllExp((v) => !v)}>{showAllExp ? "Show fewer" : `Show all ${exp.length}`}</button>}
                  </ol>
                ))}
              </section>

              <section className="border-t border-border/60 pt-4">
                <Head id="education" icon={GraduationCap} label="Education" count={edu.length} />
                {open.education && (edu.length === 0 ? <p className="py-2 text-[13px] text-muted-foreground">No education listed.</p> : (
                  <ul className="mt-2 space-y-3">
                    {edu.map((e, i) => (
                      <li key={i} className="flex gap-3">
                        <OrgLogo name={e.school ?? "?"} src={e.logoUrl} fallbackSrc={favicon(e.logoDomain)} className="h-10 w-10 rounded-lg" />
                        <div className="min-w-0">
                          <p className="text-[14px] font-medium">{e.school}</p>
                          <p className="text-[13px] text-muted-foreground">{[e.degree, e.major, yr(e.endDate)].filter(Boolean).join(" · ")}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                ))}
              </section>

              <section className="border-t border-border/60 pt-4">
                <Head id="industry" icon={Sparkles} label="Research and industry ties" />
                {open.industry && <div className="mt-2"><DoctorIntelTab person={candidate} /></div>}
              </section>
            </div>
          </div>

          {/* Right: decision */}
          <aside className="flex min-h-0 flex-col border-t border-border/70 bg-secondary/30 md:border-l md:border-t-0">
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
              <MatchFacts item={item} />
              {item.why && <p className="text-[13px] leading-relaxed text-foreground/75">{item.why}</p>}
              {p.linkedin_url && (
                <ContactEnrichPanel key={item.id} state={contactEnrich.state} busy={contactEnrich.busy} onEnrich={contactEnrich.run}
                  onCopy={async (v, l) => { await navigator.clipboard.writeText(v); toast.success(`${l} copied`); }} />
              )}
              {decision ? (
                <p className="rounded-xl border border-border bg-card px-4 py-3 text-[14px]">
                  {decision.decision === "approved" ? "You saved this person." : "You passed on this person."}
                  {decision.note && <span className="mt-1 block italic text-muted-foreground">"{decision.note}"</span>}
                </p>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-1 rounded-xl bg-card p-1 shadow-sm ring-1 ring-border/70">
                    {(["approved", "passed"] as const).map((k) => (
                      <button key={k} onClick={() => { setChoice(k); setPicked([]); }}
                        className={cn("rounded-lg py-2 text-[14px] font-medium transition-colors active:scale-[0.97]",
                          choice === k ? (k === "approved" ? "bg-mint text-mint-foreground shadow-sm" : "bg-foreground text-background") : "text-muted-foreground hover:text-foreground")}>
                        {k === "approved" ? "Approve" : "Not a fit"}
                      </button>
                    ))}
                  </div>
                  <div>
                    <p className="text-[14px] font-medium">{choice === "approved" ? "What do you like? Pick any." : "Why not? Pick any."}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {options.map((t) => {
                        const on = picked.includes(t.id);
                        return (
                          <button key={t.id} onClick={() => setPicked((x) => (on ? x.filter((y) => y !== t.id) : [...x, t.id]))}
                            className={cn("rounded-full border px-3 py-1.5 text-[13px] transition-colors active:scale-[0.97]",
                              on ? "border-mint bg-mint-soft text-mint-ink" : "border-border bg-card text-foreground/80 hover:border-mint/50")}>
                            {on && <Check className="mr-1 inline h-3 w-3" />}{t.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  {choice === "passed" && city && (
                    <label className="flex items-center gap-2 text-[13px] text-foreground/80">
                      <Checkbox checked={skipCity} onCheckedChange={(v) => setSkipCity(!!v)} />Skip everyone in {city} from now on
                    </label>
                  )}
                  <div>
                    <p className="mb-1.5 text-[14px] font-medium">Tell your agent in your own words</p>
                    <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={1000} className="resize-none bg-card text-[14px]"
                      placeholder="e.g. Love the fellowship training. More people who run their own practice." />
                  </div>
                </>
              )}
            </div>
            {!decision && (
              <div className="space-y-2 border-t border-border/70 bg-card p-4">
                <Button onClick={() => submit(choice)} disabled={busy}
                  className={cn("h-11 w-full rounded-xl text-[15px]", choice === "approved" ? "bg-mint text-mint-foreground hover:bg-mint/90" : "bg-foreground text-background hover:bg-foreground/90")}>
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                  {choice === "approved" ? "Approve and save" : "Not a fit"}
                </Button>
                <button onClick={hasNext ? onNext : onClose} className="flex w-full items-center justify-center gap-1.5 py-1 text-[13px] text-muted-foreground hover:text-foreground"><Clock className="h-3.5 w-3.5" />Decide later</button>
              </div>
            )}
          </aside>
        </div>
      </DialogContent>
    </Dialog>
  );
}
