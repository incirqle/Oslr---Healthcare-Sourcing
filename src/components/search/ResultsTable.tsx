import { useRef, useState, type ComponentType } from "react";
import { DndContext, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, horizontalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDown, ArrowUp, Check, ChevronLeft, ChevronRight, CircleDashed, CircleSlash, GripVertical, Lock, Minus } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { Candidate, CriterionVerdict } from "./SearchResults";
import { FitPill } from "./FitPill";
import type { FitStatus } from "@/hooks/useCandidateFit";
import { PersonAvatar } from "./Avatars";
import { cleanDisplayName, LinkedInMark, normalizeLinkedInUrl, toTitleCase } from "./candidate-ui";
import { VERDICT_LABEL } from "./EngineDetails";
import { scoredCriteria, sectionLabel, weightPercent, type RankingCriterion, type RequiredCriterion } from "@/lib/ranking";
import { prefersReducedMotion } from "./CriteriaPanel";

export type TableSort = { key: "match"; dir: "desc" | "asc" } | { key: "criterion"; id: string } | null;

const ICON: Record<CriterionVerdict, typeof Check> = { met: Check, partial: Minus, unknown: CircleDashed, not_met: CircleSlash };
const TINT: Record<CriterionVerdict, string> = {
  met: "bg-success/15 text-success",
  partial: "bg-warning/15 text-warning",
  unknown: "bg-muted text-muted-foreground",
  not_met: "bg-destructive/15 text-destructive",
};

const reindex = (list: RankingCriterion[]) => list.map((c, i) => ({ ...c, position: i }));

export function ResultsTable({
  rows, ranking, required, selected, savedIds, fitMap, sort, onSortChange,
  onToggleSelect, onToggleSelectAll, onOpen, onFitChange, onReorder, ContactIcons,
}: {
  rows: Candidate[];
  ranking: RankingCriterion[];
  required: RequiredCriterion[];
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
  const [requiredOpen, setRequiredOpen] = useState(required.length > 0 && required.length <= 3);
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

  const th = "whitespace-nowrap px-3 py-2 text-left text-xs font-semibold text-muted-foreground";
  const td = "px-3 py-2 align-middle";

  return (
    <TooltipProvider delayDuration={120}>
      <div className="overflow-x-auto rounded-xl border border-border/50 bg-card">
        <table className="w-full min-w-max border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="[&>th]:border-b [&>th]:border-border/60">
              <th className={cn(th, "sticky left-0 z-20 w-10 bg-card")}>
                <Checkbox checked={allSelected} onCheckedChange={onToggleSelectAll} aria-label="Select all on this page" />
              </th>
              <th className={cn(th, "sticky left-10 z-20 min-w-[260px] max-w-[300px] border-r border-border/60 bg-card")}>Candidate</th>

              {required.length > 0 && (requiredOpen ? (
                required.map((r, i) => (
                  <th key={r.id} className={cn(th, "max-w-[120px] bg-muted/30")}>
                    <span className="inline-flex items-center gap-1">
                      {i === 0 && (
                        <button type="button" onClick={() => setRequiredOpen(false)} aria-label="Collapse required columns" className="rounded p-0.5 hover:bg-muted">
                          <ChevronLeft className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <span className="truncate" title={r.label}>{r.label}</span>
                    </span>
                  </th>
                ))
              ) : (
                <th className={cn(th, "bg-muted/30")}>
                  <button type="button" onClick={() => setRequiredOpen(true)} aria-label="Show each required filter" className="inline-flex items-center gap-1 rounded hover:text-foreground">
                    Required <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </th>
              ))}

              {showMatch && (
                <th className={th} aria-sort={sort?.key === "match" ? (sort.dir === "desc" ? "descending" : "ascending") : "none"}>
                  <button
                    type="button"
                    onClick={() => onSortChange(sort?.key === "match" && sort.dir === "desc" ? { key: "match", dir: "asc" } : { key: "match", dir: "desc" })}
                    className="inline-flex items-center gap-1 hover:text-foreground"
                  >
                    Match
                    {sort?.key === "match" && (sort.dir === "desc" ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />)}
                  </button>
                </th>
              )}

              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
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
                    />
                  ))}
                </SortableContext>
              </DndContext>

              <th className={th}>Shortlist</th>
              <th className={th}><span className="sr-only">Contact</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => {
              const name = toTitleCase(cleanDisplayName(c.full_name));
              const isSel = selected.has(c.id);
              const byId = new Map((c.criteria_results ?? []).map((r) => [r.criterion_id, r]));
              const rowBg = isSel ? "bg-primary/5" : "bg-card";
              return (
                <tr key={c.id} onClick={() => onOpen(c)} className={cn("group cursor-pointer [&>td]:border-b [&>td]:border-border/40 hover:[&>td]:bg-muted/40", isSel && "[&>td]:bg-primary/5")}>
                  <td className={cn(td, "sticky left-0 z-10", rowBg)} onClick={(e) => e.stopPropagation()}>
                    <Checkbox checked={isSel} onCheckedChange={() => onToggleSelect(c.id)} aria-label={`Select ${name}`} />
                  </td>
                  <td className={cn(td, "sticky left-10 z-10 min-w-[260px] max-w-[300px] border-r border-border/60", rowBg)}>
                    <div className="flex items-center gap-2.5">
                      <PersonAvatar name={name} src={c.profile_pic_url} className="h-8 w-8" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <button type="button" onClick={(e) => { e.stopPropagation(); onOpen(c); }} className="truncate text-left font-semibold text-foreground hover:underline">
                            {name}
                          </button>
                          {c.linkedin_url && (
                            <a href={normalizeLinkedInUrl(c.linkedin_url) ?? "#"} target="_blank" rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()} aria-label={`Open ${name} profile`} className="shrink-0 text-linkedin-foreground hover:opacity-80">
                              <LinkedInMark className="h-3.5 w-3.5" />
                            </a>
                          )}
                          {savedIds.has(c.id) && <span className="rounded-full bg-success/10 px-1.5 text-[10px] font-medium text-success">Saved</span>}
                          {c.restored && <span className="rounded-full bg-muted px-1.5 text-[10px] text-muted-foreground">Restored by you</span>}
                        </div>
                        {c.title && <p className="truncate text-xs text-foreground/80">{toTitleCase(c.title)}</p>}
                        <p className="truncate text-xs text-muted-foreground">
                          {[c.current_employer && toTitleCase(c.current_employer), c.location && toTitleCase(c.location)].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                    </div>
                  </td>

                  {required.length > 0 && (requiredOpen ? required.map((r) => (
                    <td key={r.id} className={cn(td, "bg-muted/20")}>
                      <VerdictCell status="met" evidence={byId.get(r.id)?.evidence ?? null} section={byId.get(r.id)?.section ?? null} title={r.label} />
                    </td>
                  )) : (
                    <td className={cn(td, "bg-muted/20")}>
                      <span className="inline-flex items-center gap-1 text-xs text-success"><Check className="h-3.5 w-3.5" aria-hidden="true" />All met</span>
                    </td>
                  ))}

                  {showMatch && (
                    <td className={td}>
                      <div className="flex items-center gap-2">
                        <span className="w-9 text-right font-semibold tabular-nums text-foreground">{c.match_rate ?? 0}%</span>
                        <span className="h-1.5 w-16 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                          <span className="block h-full origin-left rounded-full bg-primary" style={{ transform: `scaleX(${(c.match_rate ?? 0) / 100})` }} />
                        </span>
                      </div>
                    </td>
                  )}

                  {ranking.map((rc) => (
                    <td key={rc.id} className={td}>
                      {rc.pending ? (
                        <span className="text-xs text-muted-foreground">Not checked yet</span>
                      ) : (
                        <VerdictCell
                          status={byId.get(rc.id)?.status ?? "unknown"}
                          evidence={byId.get(rc.id)?.evidence ?? null}
                          section={byId.get(rc.id)?.section ?? null}
                          title={rc.title}
                          mustHave={rc.must_have}
                        />
                      )}
                    </td>
                  ))}

                  <td className={td} onClick={(e) => e.stopPropagation()}>
                    <FitPill status={(fitMap?.get(c.id) ?? "unreviewed") as FitStatus} onChange={onFitChange(c.id)} size="sm" />
                  </td>
                  <td className={td} onClick={(e) => e.stopPropagation()}>
                    <ContactIcons candidate={c} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </TooltipProvider>
  );
}

function VerdictCell({ status, evidence, section, title, mustHave }: {
  status: CriterionVerdict; evidence: string | null; section: string | null; title: string; mustHave?: boolean;
}) {
  const Icon = ICON[status];
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
          <span className={cn("inline-flex h-6 w-6 items-center justify-center rounded-full", TINT[status], mustHave && status === "unknown" && "ring-1 ring-warning")}>
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
          <span className="text-xs text-muted-foreground">{label}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs text-xs">
        <p className="font-medium">{title}: {label}{mustHave && status === "unknown" ? " (must-have not shown)" : ""}</p>
        {evidence ? <p className="mt-0.5 text-muted-foreground">"{evidence}"</p> : <p className="mt-0.5 text-muted-foreground">The profile does not say.</p>}
        {where && <p className="mt-0.5 text-muted-foreground">From: {where}</p>}
      </TooltipContent>
    </Tooltip>
  );
}

function CriterionHeader({ c, weight, sorted, onSort, onMove, className }: {
  c: RankingCriterion; weight: number | null; sorted: boolean; onSort: () => void; onMove: (d: number) => void; className: string;
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
      className={cn(className, "bg-card", isDragging && "relative z-30 opacity-90")}
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
    </th>
  );
}
