import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Quote, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Candidate, CandidateCriterionResult } from "./SearchResults";
import { VerdictPill } from "./EngineDetails";
import { PersonAvatar } from "./Avatars";
import { cleanDisplayName, LinkedInMark, normalizeLinkedInUrl, toTitleCase } from "./candidate-ui";
import { useCandidateFits, useSetCandidateFit, type FitStatus } from "@/hooks/useCandidateFit";
import { sectionLabel, type RankingCriterion } from "@/lib/ranking";

type Tab = "experience" | "education" | "skills";
// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;

const str = (v: unknown) => (typeof v === "string" ? v : "");
const ym = (v: unknown) => str(v).slice(0, 7);

/**
 * Profile lines keyed by the same section ids the grader cites
 * (audit.ts auditProfileBlock): [headline], [cur0], [expN], [descN], [eduN], [summary].
 */
function profileSections(c: Candidate) {
  const raw = (c.raw ?? {}) as Row;
  const exp: Row[] = Array.isArray(raw.experience_history) ? raw.experience_history.filter(Boolean) : [];
  let expK = 0, descK = 0;
  const roles = exp.map((e) => {
    const primary = e.is_primary === true;
    const id = primary ? "cur0" : str(e.company_name) && expK < 5 ? `exp${expK++}` : null;
    const desc = str(e.summary) && descK < 4 ? `desc${descK++}` : null;
    return { e, id, desc, primary };
  });
  if (!roles.some((r) => r.primary) && (c.title || c.current_employer)) {
    roles.unshift({ e: { title: c.title, company_name: c.current_employer, start_date: raw.job_start_date }, id: "cur0", desc: null, primary: true });
  }
  const edu: Row[] = (Array.isArray(raw.education) ? raw.education : []).filter((e: Row) => e && (str(e.school_name) || (e.degrees ?? []).length));
  return {
    headline: str(raw.headline) || null,
    summary: str(raw.summary) || null,
    roles,
    edu: edu.map((e, k) => ({ e, id: k < 4 ? `edu${k}` : null })),
    skills: (c.skills ?? []).filter(Boolean),
  };
}

const tabOf = (section: string): Tab => (section.startsWith("edu") ? "education" : "experience");

export function ReviewMode({
  open,
  onOpenChange,
  candidates,
  startId,
  ranking,
  onShortlist,
  onNeedExplanations,
  savedIds,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidates: Candidate[];
  startId: string | null;
  ranking: RankingCriterion[];
  onShortlist: (c: Candidate) => void;
  onNeedExplanations: (rows: Candidate[]) => void;
  savedIds: Set<string>;
}) {
  const [index, setIndex] = useState(0);
  const [tab, setTab] = useState<Tab>("experience");
  const leftRef = useRef<HTMLDivElement | null>(null);
  const ids = useMemo(() => candidates.map((c) => c.id), [candidates]);
  const { data: fitMap } = useCandidateFits(ids);
  const setFit = useSetCandidateFit();

  useEffect(() => {
    if (!open) return;
    const i = startId ? candidates.findIndex((c) => c.id === startId) : 0;
    setIndex(Math.max(0, i));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, startId]);

  const c = candidates[index] ?? null;
  useEffect(() => {
    if (open && c) {
      onNeedExplanations([c]);
      setTab("experience");
      leftRef.current?.scrollTo({ top: 0 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, c?.id]);

  const reviewed = candidates.filter((x) => (fitMap?.get(x.id) ?? "unreviewed") !== "unreviewed").length;
  const go = (d: number) => setIndex((i) => Math.min(Math.max(0, i + d), Math.max(0, candidates.length - 1)));
  const mark = (status: FitStatus) => {
    if (!c) return;
    setFit.mutate({ personId: c.id, status });
    go(1);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === "j") { e.preventDefault(); go(1); }
      else if (k === "k") { e.preventDefault(); go(-1); }
      else if (k === "g") { e.preventDefault(); mark("good"); }
      else if (k === "m") { e.preventDefault(); mark("maybe"); }
      else if (k === "x") { e.preventDefault(); mark("not"); }
      else if (k === "s" && c) { e.preventDefault(); onShortlist(c); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const sections = c ? profileSections(c) : null;
  const results: CandidateCriterionResult[] = c?.criteria_results ?? [];
  const byId = new Map(results.map((r) => [r.criterion_id, r]));
  const cited = new Set(results.map((r) => r.section).filter(Boolean) as string[]);
  const required = results.filter((r) => r.group === "required");

  const jump = (section: string) => {
    setTab(tabOf(section));
    requestAnimationFrame(() => {
      const el = leftRef.current?.querySelector(`[data-section="${section}"]`) as HTMLElement | null;
      el?.scrollIntoView({ block: "center", behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
      el?.focus();
    });
  };

  const name = c ? toTitleCase(cleanDisplayName(c.full_name)) : "";
  const fit = c ? ((fitMap?.get(c.id) ?? "unreviewed") as FitStatus) : "unreviewed";

  const Line = ({ id, children, className }: { id: string | null; children: React.ReactNode; className?: string }) => {
    const hit = !!id && cited.has(id);
    return (
      <div
        data-section={id ?? undefined}
        tabIndex={hit ? -1 : undefined}
        className={cn("rounded-md px-3 py-2 outline-none", hit && "border-l-2 border-primary bg-primary/10", className)}
      >
        {hit && <span className="mb-1 inline-flex items-center gap-1 text-[11px] font-medium text-foreground"><Quote className="h-3 w-3" aria-hidden="true" />Cited as evidence</span>}
        {children}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[100dvh] max-h-[100dvh] w-screen max-w-none flex-col gap-0 rounded-none border-0 p-0 motion-reduce:animate-none sm:rounded-none [&>button.absolute]:hidden">
        <header className="flex items-center gap-3 border-b border-border px-5 py-3">
          {c && <PersonAvatar name={name} src={c.profile_pic_url} className="h-9 w-9" />}
          <div className="min-w-0 flex-1">
            <DialogTitle className="flex items-center gap-1.5 truncate font-display text-lg">
              {name}
              {c?.linkedin_url && (
                <a href={normalizeLinkedInUrl(c.linkedin_url) ?? "#"} target="_blank" rel="noopener noreferrer" aria-label={`Open ${name} profile`} className="text-linkedin-foreground hover:opacity-80">
                  <LinkedInMark className="h-4 w-4" />
                </a>
              )}
            </DialogTitle>
            <DialogDescription className="truncate text-xs">
              {[c?.title && toTitleCase(c.title), c?.current_employer && toTitleCase(c.current_employer), c?.location && toTitleCase(c.location)].filter(Boolean).join(" · ")}
            </DialogDescription>
          </div>
          {typeof c?.match_rate === "number" && <span className="text-sm font-semibold tabular-nums">{c.match_rate}% match</span>}
          <span className="text-xs tabular-nums text-muted-foreground">{reviewed} of {candidates.length} reviewed</span>
          <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} aria-label="Close review">
            <X className="h-4 w-4" />
          </Button>
        </header>

        {c && sections ? (
          <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[3fr_2fr]">
            <div className="flex min-h-0 flex-col border-r border-border">
              <div className="flex gap-1 border-b border-border px-5" role="tablist" aria-label="Profile">
                {(["experience", "education", "skills"] as const).map((t) => (
                  <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
                    className={cn("-mb-px border-b-2 px-3 py-2 text-sm font-medium capitalize", tab === t ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
                    {t}
                  </button>
                ))}
              </div>
              <div ref={leftRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto px-5 py-4 text-sm">
                {tab === "experience" && (
                  <>
                    {sections.headline && <Line id="headline"><p className="text-xs text-muted-foreground">Headline</p><p>{sections.headline}</p></Line>}
                    {sections.roles.map(({ e, id, desc, primary }, k) => (
                      <div key={k}>
                        <Line id={id}>
                          <p className="font-medium text-foreground">{toTitleCase(str(e.title)) || "Role"}{primary && <span className="ml-2 text-xs font-normal text-muted-foreground">Current</span>}</p>
                          <p className="text-xs text-muted-foreground">{[toTitleCase(str(e.company_name)), [ym(e.start_date), ym(e.end_date) || (primary ? "now" : "")].filter(Boolean).join(" to ")].filter(Boolean).join(" · ")}</p>
                        </Line>
                        {str(e.summary) && <Line id={desc} className="ml-3"><p className="whitespace-pre-line text-xs text-foreground/85">{str(e.summary)}</p></Line>}
                      </div>
                    ))}
                    {sections.summary && <Line id="summary"><p className="text-xs text-muted-foreground">About</p><p className="whitespace-pre-line">{sections.summary}</p></Line>}
                  </>
                )}
                {tab === "education" && (sections.edu.length === 0
                  ? <p className="text-muted-foreground">No education listed.</p>
                  : sections.edu.map(({ e, id }, k) => (
                    <Line key={k} id={id}>
                      <p className="font-medium">{toTitleCase(str(e.school_name))}</p>
                      <p className="text-xs text-muted-foreground">{[(e.degrees ?? []).join(", "), (e.majors ?? []).join(", "), ym(e.end_date) && `ended ${ym(e.end_date)}`].filter(Boolean).join(" · ")}</p>
                    </Line>
                  )))}
                {tab === "skills" && (sections.skills.length === 0
                  ? <p className="text-muted-foreground">No skills listed.</p>
                  : <ul className="flex flex-wrap gap-1.5">{sections.skills.map((s) => <li key={s} className="rounded-md border border-border px-2 py-0.5 text-xs">{s}</li>)}</ul>)}
              </div>
            </div>

            <aside className="min-h-0 overflow-y-auto px-5 py-4" aria-label="Criteria">
              <h3 className="mb-3 font-display text-sm font-semibold">Criteria</h3>
              {ranking.length === 0 && required.length === 0 && <p className="text-sm text-muted-foreground">No criteria for this search.</p>}
              <ul className="space-y-3">
                {ranking.map((rc) => {
                  const r = byId.get(rc.id);
                  return (
                    <li key={rc.id} className="rounded-lg border border-border p-3">
                      <div className="mb-1">{rc.pending ? <span className="text-xs text-muted-foreground">Not checked yet</span> : <VerdictPill status={r?.status ?? "unknown"} />}</div>
                      <p className="text-sm text-foreground">{rc.text}{rc.must_have && <span className="ml-1 text-xs text-muted-foreground">(must-have)</span>}</p>
                      {r?.evidence && <p className="mt-1 text-xs text-muted-foreground">"{r.evidence}"</p>}
                      {!rc.pending && (r?.explanation
                        ? <p className="mt-1 text-xs text-foreground/85">{r.explanation}</p>
                        : r && <p className="mt-1 text-xs text-muted-foreground/70">Explaining...</p>)}
                      {r?.section && (
                        <button type="button" onClick={() => jump(r.section!)} className="mt-1.5 inline-flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-[11px] text-foreground hover:bg-muted">
                          <Quote className="h-3 w-3" aria-hidden="true" /> {sectionLabel(r.section)}
                        </button>
                      )}
                    </li>
                  );
                })}
                {required.length > 0 && (
                  <li className="rounded-lg border border-border/60 bg-muted/20 p-3">
                    <p className="mb-1 text-xs font-semibold text-muted-foreground">Required</p>
                    <ul className="space-y-1">
                      {required.map((r) => <li key={r.criterion_id} className="flex items-center gap-2 text-xs"><VerdictPill status={r.status} /> {r.title}</li>)}
                    </ul>
                  </li>
                )}
              </ul>
            </aside>
          </div>
        ) : (
          <p className="p-6 text-sm text-muted-foreground">Nobody to review.</p>
        )}

        <footer className="flex flex-wrap items-center gap-2 border-t border-border px-5 py-3">
          <Button variant="outline" size="sm" onClick={() => go(-1)} disabled={index <= 0}><ChevronLeft className="mr-1 h-3.5 w-3.5" />Previous <Kbd>K</Kbd></Button>
          <Button variant="outline" size="sm" onClick={() => go(1)} disabled={index >= candidates.length - 1}>Next <Kbd>J</Kbd><ChevronRight className="ml-1 h-3.5 w-3.5" /></Button>
          <span className="mx-2 text-xs text-muted-foreground tabular-nums">{candidates.length ? index + 1 : 0} / {candidates.length}</span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button variant={fit === "good" ? "default" : "outline"} size="sm" onClick={() => mark("good")} aria-pressed={fit === "good"}>Good fit <Kbd>G</Kbd></Button>
            <Button variant={fit === "maybe" ? "default" : "outline"} size="sm" onClick={() => mark("maybe")} aria-pressed={fit === "maybe"}>Maybe <Kbd>M</Kbd></Button>
            <Button variant={fit === "not" ? "default" : "outline"} size="sm" onClick={() => mark("not")} aria-pressed={fit === "not"}>Not a fit <Kbd>X</Kbd></Button>
            <Button size="sm" onClick={() => c && onShortlist(c)} disabled={!c || savedIds.has(c.id)}>
              {c && savedIds.has(c.id) ? "Shortlisted" : "Shortlist"} <Kbd>S</Kbd>
            </Button>
          </div>
        </footer>
      </DialogContent>
    </Dialog>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="ml-1.5 rounded border border-border px-1 text-[10px] font-medium text-muted-foreground">{children}</kbd>;
}
