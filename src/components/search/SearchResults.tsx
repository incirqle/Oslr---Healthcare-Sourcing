import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Mail,
  Phone,
  RotateCcw,
  Search,
  SearchX,
  SlidersHorizontal,
} from "lucide-react";
import {
  cleanDisplayName,
  getAvatarToneClass,
  getInitials,
  LinkedInMark,
  normalizeLinkedInUrl,
  toTitleCase,
} from "@/components/search/candidate-ui";
import { MatchChipsRow } from "@/components/search/MatchChipsRow";
import { FitPill } from "@/components/search/FitPill";
import { BulkActionBar } from "@/components/search/BulkActionBar";
import { exportCandidatesCsv } from "@/components/search/csv-export";
import { buildMatchChips, queryIsCompanySpecific, type MatchChip } from "@/components/search/match-chips";
import type { ParsedFilters } from "@/components/search/FilterReview";
import { useCandidateFits, useSetCandidateFit, type FitStatus } from "@/hooks/useCandidateFit";

export interface Candidate {
  id: string;
  full_name: string;
  title: string | null;
  current_employer: string | null;
  location: string | null;
  linkedin_url: string | null;
  email: string | null;
  phone: string | null;
  skills: string[];
  avg_tenure_months: number | null;
  industry: string | null;
  company_size: string | null;
  preview?: boolean;
  has_email?: boolean;
  has_phone?: boolean;
  has_skills?: boolean;
  has_experience?: boolean;
  match_score?: number;
  relevance_summary?: string;
  profile_pic_url?: string | null;
  inferred_salary?: string | null;
  years_experience?: number;
  clinical_skills?: string[];
  has_contact_info?: boolean;
  summary?: string | null;
  raw?: Record<string, unknown>;
}

interface GeoScope {
  requested_city?: string | null;
  requested_state?: string | null;
  geo_expanded?: boolean;
  semantic_relaxed?: boolean;
  effective_scope?: "local" | "semantic" | "metro" | "state";
  cascade_steps_used?: string[];
}

export type SortOption = "relevance" | "recent" | "experienced" | "senior";

interface SearchResultsProps {
  query: string;
  candidates: Candidate[];
  total: number;
  selected: Set<string>;
  savedIds?: Set<string>;
  projectName?: string;
  filters: ParsedFilters;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  onOpenCandidate: (candidate: Candidate) => void;
  onSaveBulk: () => void;
  onAddToCampaignBulk?: () => void;
  onMarkFitBulk?: (status: FitStatus) => void;
  onEditFilters?: () => void;
  onNewSearch?: () => void;
  onSubmitQuery?: (query: string) => void;
  page?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  isSaving?: boolean;
  geoScope?: GeoScope | null;
  sort?: SortOption;
  onSortChange?: (s: SortOption) => void;
}

const SORT_LABELS: Record<SortOption, string> = {
  relevance: "Relevance",
  recent: "Most recent",
  experienced: "Most experienced",
  senior: "Most senior",
};

/**
 * Render the role / org / location middle column. When the query targets a
 * single company, demote the redundant org chip and surface tenure instead.
 */
function MiddleColumn({
  candidate,
  suppressCompany,
}: {
  candidate: Candidate;
  suppressCompany: boolean;
}) {
  const orgDisplay = candidate.current_employer ? toTitleCase(candidate.current_employer) : null;
  const locDisplay = candidate.location ? toTitleCase(candidate.location) : null;
  const titleDisplay = candidate.title ? toTitleCase(candidate.title) : null;

  return (
    <div className="min-w-0 space-y-0.5">
      {titleDisplay && (
        <p className="truncate text-sm font-medium text-foreground/85">{titleDisplay}</p>
      )}
      <div className="flex flex-wrap items-center gap-x-1.5 text-xs">
        {orgDisplay && (
          <span
            className={cn(
              "truncate",
              suppressCompany ? "text-muted-foreground/70" : "text-muted-foreground",
            )}
          >
            {orgDisplay}
          </span>
        )}
        {orgDisplay && locDisplay && (
          <span className="text-muted-foreground/50">·</span>
        )}
        {locDisplay && (
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <MapPin className="h-3 w-3" aria-hidden="true" />
            {locDisplay}
          </span>
        )}
      </div>
    </div>
  );
}

function ContactIcons({ candidate }: { candidate: Candidate }) {
  const hasEmail = !!candidate.email || !!candidate.has_email;
  const hasPhone = !!candidate.phone || !!candidate.has_phone;
  if (!hasEmail && !hasPhone) return null;
  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex items-center gap-1.5">
        {hasEmail && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-info/10 text-info">
                <Mail className="h-3 w-3" aria-hidden="true" />
                <span className="sr-only">Email available</span>
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">Work email available</TooltipContent>
          </Tooltip>
        )}
        {hasPhone && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-info/10 text-info">
                <Phone className="h-3 w-3" aria-hidden="true" />
                <span className="sr-only">Phone available</span>
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">Phone available</TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}

function CandidateRow({
  candidate,
  isSelected,
  isSaved,
  matchChips,
  fitStatus,
  suppressCompany,
  onToggleSelect,
  onOpenCandidate,
  onFitChange,
}: {
  candidate: Candidate;
  isSelected: boolean;
  isSaved: boolean;
  matchChips: MatchChip[];
  fitStatus: FitStatus;
  suppressCompany: boolean;
  onToggleSelect: () => void;
  onOpenCandidate: () => void;
  onFitChange: (next: FitStatus) => void;
}) {
  const displayName = toTitleCase(cleanDisplayName(candidate.full_name));

  return (
    <div
      className={cn(
        "group cursor-pointer border-b border-border/40 bg-card px-4 py-3.5 transition-colors last:border-b-0 hover:bg-muted/40",
        isSelected && "bg-primary/5",
      )}
      onClick={onOpenCandidate}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpenCandidate();
        }
      }}
    >
      <div className="flex items-start gap-3">
        {/* Checkbox — visible on hover or when something is selected */}
        <div
          className={cn(
            "pt-1 transition-opacity",
            isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100",
          )}
          onClick={(event) => event.stopPropagation()}
        >
          <Checkbox
            checked={isSelected}
            onCheckedChange={onToggleSelect}
            aria-label={`Select ${displayName}`}
            className="h-4 w-4 rounded border-border data-[state=checked]:border-primary data-[state=checked]:bg-primary"
          />
        </div>

        {/* Avatar */}
        {candidate.profile_pic_url ? (
          <img
            src={candidate.profile_pic_url}
            alt=""
            className="h-10 w-10 shrink-0 rounded-full object-cover"
            onError={(event) => {
              (event.target as HTMLImageElement).style.display = "none";
              (event.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
            }}
          />
        ) : null}
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold",
            getAvatarToneClass(displayName),
            candidate.profile_pic_url ? "hidden" : "flex",
          )}
        >
          {getInitials(displayName)}
        </div>

        {/* Main grid: identity + middle + chips + actions */}
        <div className="grid min-w-0 flex-1 grid-cols-1 items-start gap-3 lg:grid-cols-12">
          {/* Identity (name + linkedin) — col 1-3 */}
          <div className="lg:col-span-3 min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="truncate text-[15px] font-semibold text-foreground">{displayName}</h3>
              {candidate.linkedin_url && (
                <a
                  href={normalizeLinkedInUrl(candidate.linkedin_url) ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-info hover:opacity-80"
                  onClick={(event) => event.stopPropagation()}
                  aria-label={`Open ${displayName} on LinkedIn`}
                >
                  <LinkedInMark className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
            {candidate.years_experience ? (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {candidate.years_experience}y experience
              </p>
            ) : null}
          </div>

          {/* Middle column: title + org + location — col 4-7 */}
          <div className="lg:col-span-4 min-w-0">
            <MiddleColumn candidate={candidate} suppressCompany={suppressCompany} />
          </div>

          {/* Match chips — col 8-10 */}
          <div className="lg:col-span-3 min-w-0">
            <MatchChipsRow chips={matchChips} />
          </div>

          {/* Actions — col 11-12 */}
          <div
            className="flex items-center justify-end gap-2 lg:col-span-2"
            onClick={(event) => event.stopPropagation()}
          >
            <ContactIcons candidate={candidate} />
            <FitPill status={fitStatus} onChange={onFitChange} />
            {isSaved && (
              <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-300">
                Saved
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function SearchResults({
  query,
  candidates,
  total,
  selected,
  savedIds = new Set(),
  projectName,
  filters,
  onToggleSelect,
  onToggleSelectAll,
  onOpenCandidate,
  onSaveBulk,
  onAddToCampaignBulk,
  onMarkFitBulk,
  onEditFilters,
  onNewSearch,
  onSubmitQuery,
  page = 1,
  pageSize = 15,
  onPageChange,
  isSaving = false,
  geoScope = null,
  sort = "relevance",
  onSortChange,
}: SearchResultsProps) {
  const [queryDraft, setQueryDraft] = useState(query);
  const totalPages = Math.ceil(total / pageSize);
  const suppressCompany = queryIsCompanySpecific(filters);

  useEffect(() => {
    setQueryDraft(query);
  }, [query]);

  // Match chips per candidate (memoized — only recompute when filters or list change)
  const matchChipsByCandidate = useMemo(() => {
    const map = new Map<string, MatchChip[]>();
    for (const c of candidates) {
      map.set(c.id, buildMatchChips(c, filters));
    }
    return map;
  }, [candidates, filters]);

  // Fit ratings — single batched query for all visible candidates
  const pdlIds = candidates.map((c) => c.id);
  const { data: fitMap } = useCandidateFits(pdlIds);
  const setFit = useSetCandidateFit();

  const handleFitChange = (pdlId: string) => (next: FitStatus) => {
    setFit.mutate({ pdlId, status: next });
  };

  const handleMarkFitBulk = (status: FitStatus) => {
    [...selected].forEach((pdlId) => setFit.mutate({ pdlId, status }));
    onMarkFitBulk?.(status);
  };

  const handleExportCsv = () => {
    const list = candidates.filter((c) => selected.has(c.id));
    const fitOnlyStrings = new Map<string, string>();
    fitMap?.forEach((value, key) => fitOnlyStrings.set(key, value));
    exportCandidatesCsv(list, matchChipsByCandidate, fitOnlyStrings);
  };

  const geoBannerText = (() => {
    const scope = geoScope?.effective_scope;
    const city = geoScope?.requested_city;
    if (scope === "state" && city && geoScope?.requested_state) {
      return `Few results in ${toTitleCase(city)} — expanded to all of ${toTitleCase(geoScope.requested_state)}`;
    }
    if (scope === "metro" && city) {
      return `Few results in ${toTitleCase(city)} — expanded to the wider metro area`;
    }
    if (scope === "semantic" && city) {
      return `Few exact matches in ${toTitleCase(city)} — relaxed specialty/title filters but kept the location`;
    }
    return null;
  })();

  if (candidates.length === 0) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center px-4 text-center">
        <div className="mb-4 rounded-full bg-muted p-5">
          <SearchX className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="mb-2 text-lg font-bold text-foreground">No results found</h3>
        <p className="mb-5 max-w-sm text-sm text-muted-foreground">
          Try broadening your search by removing some filters or expanding your location.
        </p>
        {onEditFilters && (
          <Button variant="outline" onClick={onEditFilters} className="h-10 gap-1.5">
            <SlidersHorizontal className="h-4 w-4" />
            Edit Criteria
          </Button>
        )}
      </div>
    );
  }

  // Build a short query-context summary for the header subtitle.
  const queryContext = (() => {
    const parts: string[] = [];
    if ((filters.specialties ?? []).length) parts.push(toTitleCase(filters.specialties[0]));
    if ((filters.job_titles ?? []).length) parts.push(toTitleCase(filters.job_titles[0]));
    if ((filters.companies ?? []).length) parts.push(`at ${toTitleCase(filters.companies[0])}`);
    if ((filters.locations ?? []).length) parts.push(`in ${toTitleCase(filters.locations[0])}`);
    return parts.join(" ");
  })();

  return (
    <div className="space-y-4">
      {geoBannerText && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          <MapPin className="h-4 w-4 shrink-0 text-amber-400" />
          {geoBannerText}
        </div>
      )}

      {/* Inline query rerun bar */}
      <form
        className="relative"
        onSubmit={(event) => {
          event.preventDefault();
          if (!queryDraft.trim() || !onSubmitQuery) return;
          onSubmitQuery(queryDraft.trim());
        }}
      >
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={queryDraft}
          onChange={(event) => setQueryDraft(event.target.value)}
          placeholder="Refine your search…"
          className="h-11 rounded-lg border-border bg-card pl-11 pr-4 text-sm shadow-none"
        />
      </form>

      {/* Bulk action bar — only when something is selected */}
      {selected.size > 0 && (
        <BulkActionBar
          count={selected.size}
          projectName={projectName}
          onAddToProject={onSaveBulk}
          onAddToCampaign={() => onAddToCampaignBulk?.()}
          onMarkFit={handleMarkFitBulk}
          onExportCsv={handleExportCsv}
          onClear={() => onToggleSelectAll()}
          isSaving={isSaving}
        />
      )}

      {/* Header: count + query context · sort · refine · new search */}
      <div className="flex flex-col gap-2 border-b border-border/50 pb-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-2xl font-bold leading-tight text-foreground">
            {total.toLocaleString()} candidates
          </h2>
          {queryContext && (
            <p className="mt-0.5 truncate text-sm text-muted-foreground">{queryContext}</p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onSortChange && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 gap-1.5">
                  Sort: {SORT_LABELS[sort]}
                  <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {(Object.keys(SORT_LABELS) as SortOption[]).map((opt) => (
                  <DropdownMenuItem key={opt} onClick={() => onSortChange(opt)}>
                    {SORT_LABELS[opt]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {onEditFilters && (
            <Button variant="outline" size="sm" onClick={onEditFilters} className="h-9 gap-1.5">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Refine
            </Button>
          )}
          {onNewSearch && (
            <Button variant="outline" size="sm" onClick={onNewSearch} className="h-9 gap-1.5">
              <RotateCcw className="h-3.5 w-3.5" />
              New Search
            </Button>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border/50 bg-card">
        {candidates.map((candidate) => (
          <CandidateRow
            key={candidate.id}
            candidate={candidate}
            isSelected={selected.has(candidate.id)}
            isSaved={savedIds.has(candidate.id)}
            matchChips={matchChipsByCandidate.get(candidate.id) ?? []}
            fitStatus={(fitMap?.get(candidate.id) ?? "unreviewed") as FitStatus}
            suppressCompany={suppressCompany}
            onToggleSelect={() => onToggleSelect(candidate.id)}
            onOpenCandidate={() => onOpenCandidate(candidate)}
            onFitChange={handleFitChange(candidate.id)}
          />
        ))}
      </div>

      {totalPages > 1 && onPageChange && (
        <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total.toLocaleString()}
          </p>

          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
              className="h-9 gap-1.5"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Previous
            </Button>

            {Array.from({ length: Math.min(totalPages, 5) }, (_, index) => {
              let pageNumber = index + 1;
              if (totalPages > 5) {
                if (page <= 3) pageNumber = index + 1;
                else if (page >= totalPages - 2) pageNumber = totalPages - 4 + index;
                else pageNumber = page - 2 + index;
              }
              const isCurrentPage = pageNumber === page;
              return (
                <Button
                  key={pageNumber}
                  variant="outline"
                  size="sm"
                  onClick={() => onPageChange(pageNumber)}
                  className={cn(
                    "h-9 w-9 p-0 text-sm",
                    isCurrentPage && "border-primary bg-primary/10 text-primary hover:bg-primary/15",
                  )}
                >
                  {pageNumber}
                </Button>
              );
            })}

            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
              className="h-9 gap-1.5"
            >
              Next
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
