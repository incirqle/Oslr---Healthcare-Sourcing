import { Lock, RotateCcw, SlidersHorizontal } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { ParsedFilters } from "./FilterReview";
import { scoredCriteria, weightPercent, type RankingCriterion, type RequiredCriterion } from "@/lib/ranking";
import { toTitleCase } from "./candidate-ui";

/** Which filter editor section a Required chip opens (spec 9.1). */
export type FilterField = "role_class" | "employment_model" | "locations" | "job_titles" | "companies" | "experience_years" | "specialties" | "keywords";

export function fieldForKind(kind: string): FilterField {
  switch (kind) {
    case "location": return "locations";
    case "company": case "past_company": case "employer_group": case "employer_size": return "companies";
    case "experience": case "tenure": case "job_change": return "experience_years";
    case "specialty": return "specialties";
    case "title": case "training_stage": case "credential": case "education": return "job_titles";
    case "role_class": return "role_class";
    case "employment_model": return "employment_model";
    default: return "keywords";
  }
}

const CANT_CHECK_TIP = "Oslr has no data for this yet. This was not used to filter or rank.";

/** Required chips from the current filters, used when the engine sent none (what FilterReview showed). */
function chipsFromFilters(f: ParsedFilters): { label: string; field: FilterField }[] {
  return [
    ...(f.role_class ? [{ label: toTitleCase(f.role_class.replace(/_/g, " ")), field: "role_class" as const }] : []),
    ...f.job_titles.map((t) => ({ label: t, field: "job_titles" as const })),
    ...f.specialties.map((s) => ({ label: s, field: "specialties" as const })),
    ...f.companies.map((c) => ({ label: c, field: "companies" as const })),
    ...f.locations.map((l) => ({ label: l, field: "locations" as const })),
    ...(f.experience_years ? [{ label: `${f.experience_years}+ years`, field: "experience_years" as const }] : []),
    ...(f.employment_model ? [{ label: f.employment_model === "private_practice" ? "Private practice" : "Hospital employed", field: "employment_model" as const }] : []),
    ...f.keywords.map((k) => ({ label: k, field: "keywords" as const })),
  ];
}

const chip = "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs transition-colors";

export function QueryReadback({
  query,
  filters,
  required,
  ranking,
  cantCheck,
  keptCount,
  setAsideCount,
  onOpenFilter,
  onOpenCriteria,
  onReset,
}: {
  query: string;
  filters: ParsedFilters;
  required: RequiredCriterion[];
  ranking: RankingCriterion[];
  cantCheck: { id: string; label: string }[];
  keptCount: number;
  setAsideCount: number;
  onOpenFilter: (field?: FilterField) => void;
  onOpenCriteria: () => void;
  onReset?: () => void;
}) {
  const requiredChips = required.length > 0
    ? required.map((r) => ({ label: r.label, field: fieldForKind(r.kind) }))
    : chipsFromFilters(filters);
  const scored = scoredCriteria(ranking);
  const n = scored.length;
  const pos = new Map(scored.map((c, i) => [c.id, i]));

  return (
    <section className="space-y-2.5 rounded-xl border border-border/60 bg-card px-4 py-3.5" aria-label="What this search checked">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="min-w-0 text-sm text-foreground">{query}</p>
        <p className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {keptCount.toLocaleString()} {keptCount === 1 ? "match" : "matches"} · {setAsideCount.toLocaleString()} set aside
        </p>
      </div>

      <TooltipProvider delayDuration={150}>
        <div className="space-y-1.5">
          <Row label="Required">
            {requiredChips.length === 0 && <span className="text-xs text-muted-foreground">None</span>}
            {requiredChips.map((c, i) => (
              <button key={`${c.field}-${c.label}-${i}`} type="button" onClick={() => onOpenFilter(c.field)}
                className={cn(chip, "border-border bg-secondary text-foreground hover:bg-muted")}
                aria-label={`Required: ${c.label}. Edit this filter`}>
                {c.label}
              </button>
            ))}
          </Row>

          <Row label="Preferred">
            {ranking.length === 0 && (
              <button type="button" onClick={onOpenCriteria} className={cn(chip, "border-dashed border-border text-muted-foreground hover:text-foreground")}>
                Add a criterion to rank by
              </button>
            )}
            {ranking.map((c) => (
              <button key={c.id} type="button" onClick={onOpenCriteria}
                className={cn(chip, "border-primary/30 bg-primary/10 text-foreground hover:bg-primary/15")}
                aria-label={`Preferred: ${c.title}. Open ranking criteria`}>
                {c.must_have && <Lock className="h-3 w-3" aria-label="Must-have" />}
                {c.title}
                <span className="tabular-nums text-muted-foreground">
                  {c.pending ? "(not checked yet)" : `(${weightPercent(pos.get(c.id)!, n)}%)`}
                </span>
              </button>
            ))}
          </Row>

          {cantCheck.length > 0 && (
            <Row label="Can't check">
              {cantCheck.map((c) => (
                <Tooltip key={c.id}>
                  <TooltipTrigger asChild>
                    <span tabIndex={0} className={cn(chip, "border-border/60 text-muted-foreground line-through")}>{c.label}</span>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-xs">{CANT_CHECK_TIP}</TooltipContent>
                </Tooltip>
              ))}
            </Row>
          )}
        </div>
      </TooltipProvider>

      <div className="flex items-center gap-3 pt-0.5">
        <button type="button" onClick={() => onOpenFilter()} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
          <SlidersHorizontal className="h-3 w-3" /> Edit filters
        </button>
        <button type="button" onClick={onOpenCriteria} className="text-xs font-medium text-primary hover:underline">
          Ranking criteria
        </button>
        {onReset && (
          <button type="button" onClick={onReset} className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <RotateCcw className="h-3 w-3" /> Reset search
          </button>
        )}
      </div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="w-[5.5rem] shrink-0 text-xs font-semibold text-muted-foreground">{label}:</span>
      {children}
    </div>
  );
}
