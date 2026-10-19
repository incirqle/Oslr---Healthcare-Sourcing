import { useRef, type ComponentType } from "react";
import { DndContext, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, horizontalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDown, ArrowUp, GripVertical, Lock, Plus } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { Candidate, CriterionVerdict } from "./SearchResults";
import { FitPill } from "./FitPill";
import type { FitStatus } from "@/hooks/useCandidateFit";
import { faviconUrl, OrgLogo, PersonAvatar } from "./Avatars";
import { cleanDisplayName, LinkedInMark, normalizeLinkedInUrl, toTitleCase } from "./candidate-ui";
import { VERDICT_LABEL, VerdictMark } from "./EngineDetails";
import { scoredCriteria, sectionLabel, weightPercent, type RankingCriterion, type RequiredCriterion } from "@/lib/ranking";
import { prefersReducedMotion } from "./CriteriaPanel";

export type CriterionCheck = { state: "checking"; count: number } | { state: "error"; message: string };

export type TableSort = { key: "match"; dir: "desc" | "asc" } | { key: "criterion"; id: string } | null;

const reindex = (list: RankingCriterion[]) => list.map((c, i) => ({ ...c, position: i }));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

const NOT_A_PROGRAM = /\b(academy|association|society|board|college of surgeons)\b/i;

/** The school to show: fellowship, then residency, then medical school, then the first listed. */
export function educationFor(c: Candidate): { name: string; logo: string | null } | null {
  const list = (Array.isArray(c.raw?.education) ? c.raw!.education : []) as Row[];
  const named = list.filter((e) => typeof e?.school_name === "string" && e.school_name.trim() && !NOT_A_PROGRAM.test(e.school_name));
  if (named.length === 0) return null;
  const text = (e: Row) => [...(e.degrees ?? []), ...(e.majors ?? [])].join(" ");
  const pick =
    named.find((e) => /fellow/i.test(text(e))) ??
    named.find((e) => /residen/i.test(text(e))) ??
    named.find((e) => /\b(md|do|doctor of medicine|medicine)\b/i.test(text(e))) ??
    named[0];
  return { name: toTitleCase(pick.school_name), logo: typeof pick.school_logo_url === "string" ? pick.school_logo_url : null };
}

const PRACTICE_LABEL: Record<string, string> = { private_practice: "Private practice", hospital_employed: "Hospital employed" };

export function ResultsTable({
  rows, ranking, selected, savedIds, fitMap, sort, onSortChange,
  onToggleSelect, onToggleSelectAll, onOpen, onFitChange, onReorder, ContactIcons,
  checks = {}, onRetry, onReview, onAddCriteria,
}: {
  onAddCriteria?: () => void;
  checks?: Record<string, CriterionCheck>;
  onRetry?: (id: string) => void;
  onReview?: (c: Candidate) => void;
  rows: Candidate[];
  ranking: RankingCriterion[];
  /** Kept for callers; every row already passed the required filters, so no column is shown for them. */
  required?: RequiredCriterion[];
  selected: Set<string>;
  savedIds: Set<string>;
  fitMap?: Map<string, FitStatus>;
  sort: TableSort;
  onSortChange: (s: TableSort) => void;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  onOpen: (c: Candidate) => void;
  onFitChange: (id: string) => (next: FitStatus) => void;
  onReorder: (next: RankingCriterion[]) => void;
  ContactIcons: ComponentType<{ candidate: Candidate }>;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 300, tolerance: 6 } }),
  );
  const scored = scoredCriteria(ranking);
  const pos = new Map(scored.map((c, i) => [c.id, i]));
  const showMatch = scored.length > 0;
  const allSelected = rows.length > 0 && rows.filter((r) => !savedIds.has(r.id)).every((r) => selected.has(r.id));

  const move = (from: number, to: number) => {
    if (to < 0 || to >= ranking.length || from === to) return;
    onReorder(reindex(arrayMove(ranking, from, to)));
  };
  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    move(ranking.findIndex((c) => c.id === e.active.id), ranking.findIndex((c) => c.id === e.over!.id));
  };

  const th = "sticky top-0 z-10 whitespace-nowrap border-b border-border bg-card px-4 py-3 text-left text-[13px] font-medium text-muted-foreground";
  const td = "border-b border-border/60 px-4 py-3 align-middle text-[14px] text-foreground";
  const cellText = "block truncate";

  return (
    <TooltipProvider delayDuration={120}>
      {/* DndContext wraps the whole table: rendered inside a <tr> its hidden
          announcer became an extra header cell and pushed Shortlist out of line. */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <div className="max-h-[calc(100vh-14rem)] overflow-auto overscroll-contain rounded-xl border border-border bg-card [scrollbar-gutter:stable]">
          <table className="w-full min-w-max border-separate border-spacing-0">
            <thead>
              <tr>
                <th className={cn(th, "left-0 z-30 w-12 pr-0")}>
                  <Checkbox checked={allSelected} onCheckedChange={onToggleSelectAll} aria-label="Select all on this page" />
                </th>
                <th className={cn(th, "left-12 z-30 min-w-[230px] border-r border-border")}>Name</th>
                {showMatch && (
                  <th className={th} aria-sort={sort?.key === "match" ? (sort.dir === "desc" ? "descending" : "ascending") : "none"}>
                    <button
                      type="button"
                      onClick={() => onSortChange(sort?.key === "match" && sort.dir === "desc" ? { key: "match", dir: "asc" } : { key: "match", dir: "desc" })}
                      className="inline-flex items-center gap-1 hover:text-foreground"
                    >
                      Match
                      {sort?.key === "match" && (sort.dir === "desc" ? <ArrowDown className="h-3.5 w-3.5" /> : <ArrowUp className="h-3.5 w-3.5" />)}
                    </button>
                  </th>
                )}

                <SortableContext items={ranking.map((c) => c.id)} strategy={horizontalListSortingStrategy}>
                  {ranking.map((c, i) => (
                    <CriterionHeader
                      key={c.id}
                      c={c}
                      weight={c.pending ? null : weightPercent(pos.get(c.id)!, scored.length)}
                      sorted={sort?.key === "criterion" && sort.id === c.id}
                      onSort={() => onSortChange(sort?.key === "criterion" && sort.id === c.id ? null : { key: "criterion", id: c.id })}
                      onMove={(d) => move(i, i + d)}
                      className={th}
                      check={checks[c.id]}
                      onRetry={onRetry ? () => onRetry(c.id) : undefined}
                    />
                  ))}
                </SortableContext>

                {onAddCriteria && (
                  <th className={cn(th, "pr-6")}>
                    <button type="button" onClick={onAddCriteria}
                      className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-border px-2.5 py-1 text-[13px] font-medium text-foreground/80 transition-colors duration-150 hover:border-primary/60 hover:text-foreground">
                      <Plus className="h-3.5 w-3.5" /> Add criteria
                    </button>
                  </th>
                )}

                <th className={th}>Job title</th>
                <th className={th}>Company</th>
                <th className={th}>Education</th>
                <th className={th}>Location</th>
                <th className={th}>Experience</th>
                <th className={th}>Practice type</th>
                <th className={cn(th, "sticky right-0 z-20 border-l border-border")}>Shortlist</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => {
                const name = toTitleCase(cleanDisplayName(c.full_name));
                const isSel = selected.has(c.id);
                const byId = new Map((c.criteria_results ?? []).map((r) => [r.criterion_id, r]));
                const rowBg = isSel ? "bg-primary/5" : "bg-card group-hover:bg-muted";
                const company = c.current_employer ? toTitleCase(c.current_employer) : null;
                const edu = educationFor(c);
                const practice = c.employment_model ? PRACTICE_LABEL[c.employment_model] : undefined;
                return (
                  <tr key={c.id} onClick={() => onOpen(c)} className={cn("group cursor-pointer", isSel ? "[&>td]:bg-primary/5" : "hover:[&>td]:bg-muted")}>
                    <td className={cn(td, "sticky left-0 z-10 w-12 pr-0", rowBg)} onClick={(e) => e.stopPropagation()}>
                      <Checkbox checked={isSel} onCheckedChange={() => onToggleSelect(c.id)} aria-label={`Select ${name}`} />
                    </td>
                    <td className={cn(td, "sticky left-12 z-10 min-w-[230px] max-w-[280px] border-r border-border", rowBg)}>
                      <div className="flex items-center gap-2.5">
                        <PersonAvatar name={name} src={c.profile_pic_url} className="h-8 w-8" />
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); (onReview ?? onOpen)(c); }}
                          className="truncate text-left font-semibold text-foreground hover:underline"
                        >
                          {name}
                        </button>
                        {c.linkedin_url && (
                          <a
                            href={normalizeLinkedInUrl(c.linkedin_url) ?? "#"}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            aria-label={`Open ${name} profile`}
                            className="shrink-0 text-linkedin-foreground hover:opacity-80"
                          >
                            <LinkedInMark className="h-4 w-4" />
                          </a>
                        )}
                        {savedIds.has(c.id) && <span className="shrink-0 rounded-full bg-success/10 px-1.5 text-[11px] font-medium text-success">Saved</span>}
                      </div>
                    </td>

                    {showMatch && (
                      <td className={td}>
                        <div className="flex items-center gap-2">
                          <span className="w-10 text-right font-semibold tabular-nums">{c.match_rate ?? 0}%</span>
                          <span className="h-1.5 w-16 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                            <span className="block h-full origin-left rounded-full bg-primary" style={{ transform: `scaleX(${(c.match_rate ?? 0) / 100})` }} />
                          </span>
                        </div>
                      </td>
                    )}

                    {ranking.map((rc) => (
                      <td key={rc.id} className={td}>
                        {rc.pending ? (
                          <span className="text-[13px] text-muted-foreground">
                            {checks[rc.id]?.state === "checking" ? "Checking" : checks[rc.id]?.state === "error" ? "Not checked" : "Not checked yet"}
                          </span>
                        ) : (
                          <VerdictCell
                            status={byId.get(rc.id)?.status ?? "unknown"}
                            evidence={byId.get(rc.id)?.evidence ?? null}
                            section={byId.get(rc.id)?.section ?? null}
                            title={rc.title}
                            mustHave={rc.must_have}
                            explanation={byId.get(rc.id)?.explanation ?? null}
                          />
                        )}
                      </td>
                    ))}
                    {onAddCriteria && <td className={td} />}

                    <td className={cn(td, "max-w-[200px]")}>
                      <span className={cellText} title={c.title ?? undefined}>{c.title ? toTitleCase(c.title) : "-"}</span>
                    </td>
                    <td className={cn(td, "max-w-[230px]")}>
                      {company ? (
                        <span className="flex min-w-0 items-center gap-2">
                          <OrgLogo name={company} src={c.company_logo_url} fallbackSrc={faviconUrl(c.company_domain)} className="h-6 w-6" textClassName="text-[9px]" />
                          <span className={cellText} title={company}>{company}</span>
                        </span>
                      ) : "-"}
                    </td>
                    <td className={cn(td, "max-w-[230px]")}>
                      {edu ? (
                        <span className="flex min-w-0 items-center gap-2">
                          <OrgLogo name={edu.name} src={edu.logo} className="h-6 w-6" textClassName="text-[9px]" />
                          <span className={cellText} title={edu.name}>{edu.name}</span>
                        </span>
                      ) : "-"}
                    </td>
                    <td className={cn(td, "max-w-[160px]")}>
                      <span className={cellText}>{c.location ? toTitleCase(c.location) : "-"}</span>
                    </td>
                    <td className={cn(td, "tabular-nums")}>{c.years_experience ? `${c.years_experience} yrs` : "-"}</td>
                    <td className={td}>{practice ?? <span className="text-muted-foreground">Not listed</span>}</td>

                    <td className={cn(td, "sticky right-0 z-10 border-l border-border", rowBg)} onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-2">
                        <FitPill status={(fitMap?.get(c.id) ?? "unreviewed") as FitStatus} onChange={onFitChange(c.id)} size="sm" />
                        <ContactIcons candidate={c} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </DndContext>
    </TooltipProvider>
  );
}

function VerdictCell({ status, evidence, section, title, mustHave, explanation }: {
  status: CriterionVerdict; evidence: string | null; section: string | null; title: string; mustHave?: boolean; explanation?: string | null;
}) {
  const label = VERDICT_LABEL[status];
  const where = sectionLabel(section);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          onClick={(e) => e.stopPropagation()}
          aria-label={`${title}: ${label}${evidence ? `. ${evidence}` : ""}`}
          className="inline-flex items-center gap-1.5 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <VerdictMark status={status} className={cn(mustHave && status === "unknown" && "ring-2 ring-[#0A1F44]/30 ring-offset-1")} />
          <span className={cn("text-[13.5px]", status === "met" || status === "partial" ? "text-foreground" : "text-muted-foreground")}>{label}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs text-xs">
        <p className="font-medium">{title}: {label}{mustHave && status === "unknown" ? " (must-have not shown)" : ""}</p>
        {evidence ? <p className="mt-0.5 text-muted-foreground">"{evidence}"</p> : <p className="mt-0.5 text-muted-foreground">The profile does not say.</p>}
        {explanation && <p className="mt-0.5">{explanation}</p>}
        {where && <p className="mt-0.5 text-muted-foreground">From: {where}</p>}
      </TooltipContent>
    </Tooltip>
  );
}

function CriterionHeader({ c, weight, sorted, onSort, onMove, className, check, onRetry }: {
  c: RankingCriterion; weight: number | null; sorted: boolean; onSort: () => void; onMove: (d: number) => void; className: string;
  check?: CriterionCheck; onRetry?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: c.id,
    transition: prefersReducedMotion() ? null : { duration: 180, easing: "ease-out" },
  });
  const handleRef = useRef<HTMLButtonElement | null>(null);
  return (
    <th
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(className, isDragging && "relative z-30 opacity-90")}
      aria-sort={sorted ? "descending" : "none"}
    >
      <span className="inline-flex items-center gap-1">
        <button
          ref={handleRef}
          type="button"
          {...attributes}
          {...listeners}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") { e.preventDefault(); onMove(-1); requestAnimationFrame(() => handleRef.current?.focus()); }
            if (e.key === "ArrowRight") { e.preventDefault(); onMove(1); requestAnimationFrame(() => handleRef.current?.focus()); }
          }}
          aria-label={`Move ${c.title} column. Use Left and Right arrow keys.`}
          className="cursor-grab touch-none rounded p-0.5 hover:bg-muted active:cursor-grabbing"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
        <button type="button" onClick={onSort} className="inline-flex items-center gap-1 hover:text-foreground" title={c.text}>
          {c.must_have && <Lock className="h-3 w-3" aria-label="Must-have" />}
          <span className="text-foreground">{c.title}</span>
          <span className="tabular-nums">{weight === null ? "new" : `${weight}%`}</span>
          {sorted && <ArrowDown className="h-3 w-3" aria-hidden="true" />}
        </button>
      </span>
      {check?.state === "checking" && (
        <span className="mt-0.5 block text-[11px] font-normal text-muted-foreground" role="status">Checking {check.count} profiles</span>
      )}
      {check?.state === "error" && (
        <span className="mt-0.5 flex items-center gap-1.5 text-[11px] font-normal text-destructive" role="alert">
          <span className="max-w-[160px] truncate" title={check.message}>{check.message}</span>
          {onRetry && <button type="button" onClick={onRetry} className="font-medium text-foreground underline">Retry</button>}
        </span>
      )}
    </th>
  );
}
