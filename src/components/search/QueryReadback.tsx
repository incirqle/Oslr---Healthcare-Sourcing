import { ListOrdered, Lock, Plus, RotateCcw, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
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

const chip = "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-left text-[13.5px] transition-colors";

export function QueryReadback({
  query,
  filters,
  required,
  ranking,
  cantCheck,
  keptCount,
  suggestions = [],
  onAddSuggestion,
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
  suggestions?: string[];
  onAddSuggestion?: (text: string) => void;
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
  const taken = new Set(ranking.map((c) => c.text.toLowerCase().trim()));
  const quickAdd = suggestions.filter((x) => !taken.has(x.toLowerCase().trim())).slice(0, 3);

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card" aria-label="Your search">
      <div className="space-y-3 px-5 py-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="min-w-0 text-[15px] font-medium text-foreground">{query}</p>
          <p className="shrink-0 text-[14px] tabular-nums text-muted-foreground">
            {keptCount.toLocaleString()} {keptCount === 1 ? "candidate" : "candidates"}
          </p>
        </div>

        <TooltipProvider delayDuration={150}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13.5px] font-semibold text-foreground/70">Searching for</span>
            {requiredChips.map((c, i) => (
              <button key={`${c.field}-${c.label}-${i}`} type="button" onClick={() => onOpenFilter(c.field)}
                className={cn(chip, "border-border bg-secondary text-foreground hover:bg-muted")}
                aria-label={`${c.label}. Edit this filter`}>
                {c.label}
              </button>
            ))}
            {cantCheck.map((c) => (
              <Tooltip key={c.id}>
                <TooltipTrigger asChild>
                  <span tabIndex={0} className={cn(chip, "border-border/60 text-muted-foreground line-through")}>{c.label}</span>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs text-xs">{CANT_CHECK_TIP}</TooltipContent>
              </Tooltip>
            ))}
            <button type="button" onClick={() => onOpenFilter()} className={cn(chip, "border-border text-foreground/80 hover:bg-muted")}>
              <SlidersHorizontal className="h-3.5 w-3.5" /> Edit filters
            </button>
            {onReset && (
              <button type="button" onClick={onReset} className="ml-auto inline-flex items-center gap-1.5 text-[13.5px] text-muted-foreground hover:text-foreground">
                <RotateCcw className="h-3.5 w-3.5" /> Reset search
              </button>
            )}
          </div>
        </TooltipProvider>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-border bg-primary/[0.06] px-5 py-3.5">
        <span className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-foreground">
          <ListOrdered className="h-4 w-4 text-primary" aria-hidden="true" /> Ranked by
        </span>

        {ranking.length === 0 && (
          <Button size="sm" onClick={onOpenCriteria} className="h-9 gap-1.5"><Plus className="h-4 w-4" /> Add ranking criteria</Button>
        )}
        {ranking.length === 0 && quickAdd.length > 0 && (
          <span className="text-[14px] text-foreground/70">or start with:</span>
        )}
        {ranking.map((c, i) => (
          <button key={c.id} type="button" onClick={onOpenCriteria}
            className={cn(chip, "border-primary/40 bg-card text-foreground hover:bg-primary/10")}
            aria-label={`${i + 1}. ${c.title}. Open ranking`}>
            <span className="tabular-nums font-semibold text-foreground/60">{i + 1}</span>
            {c.must_have && <Lock className="h-3.5 w-3.5" aria-label="Must-have" />}
            {c.title}
            <span className="tabular-nums text-muted-foreground">
              {c.pending ? "checking" : `${weightPercent(pos.get(c.id)!, n)}%`}
            </span>
          </button>
        ))}
        {ranking.length === 0 && quickAdd.map((x) => (
          <button key={x} type="button" onClick={() => onAddSuggestion?.(x)}
            className={cn(chip, "border-dashed border-primary/50 bg-card text-foreground hover:bg-primary/10")}>
            <Plus className="h-3.5 w-3.5 text-primary" aria-hidden="true" /> {x}
          </button>
        ))}
        {ranking.length > 0 && (
          <Button size="sm" variant="outline" onClick={onOpenCriteria} className="h-9 bg-card">Edit ranking</Button>
        )}

      </div>
    </section>
  );
}
