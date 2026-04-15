import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  Mail,
  MapPin,
  RotateCcw,
  Search,
  SearchX,
  SlidersHorizontal,
} from "lucide-react";
import {
  cleanDisplayName,
  formatSalary,
  getAvatarToneClass,
  getInitials,
  LinkedInMark,
  normalizeLinkedInUrl,
} from "@/components/search/candidate-ui";

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

interface SearchResultsProps {
  query: string;
  candidates: Candidate[];
  total: number;
  selected: Set<string>;
  savedIds?: Set<string>;
  projectName?: string;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  onOpenCandidate: (candidate: Candidate) => void;
  onSaveBulk: () => void;
  onEditFilters?: () => void;
  onNewSearch?: () => void;
  onSubmitQuery?: (query: string) => void;
  page?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  isSaving?: boolean;
}

function CandidateRow({
  candidate,
  isSelected,
  isSaved,
  onToggleSelect,
  onOpenCandidate,
}: {
  candidate: Candidate;
  isSelected: boolean;
  isSaved: boolean;
  onToggleSelect: () => void;
  onOpenCandidate: () => void;
}) {
  const salary = formatSalary(candidate.inferred_salary);
  const previewSkills = candidate.clinical_skills?.length ? candidate.clinical_skills : candidate.skills;
  const visibleSkills = previewSkills.slice(0, 3);
  const extraSkills = Math.max(previewSkills.length - visibleSkills.length, 0);

  return (
    <div
      className={cn(
        "cursor-pointer border-b border-ui-border-light bg-card px-5 py-4 transition-colors last:border-b-0 hover:bg-ui-surface-hover",
        isSelected && "bg-ui-surface-selected",
      )}
      onClick={onOpenCandidate}
    >
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:gap-5">
        <div className="flex min-w-0 flex-1 items-start gap-4">
          <div className="pt-1" onClick={(event) => event.stopPropagation()}>
            {isSaved ? (
              <div className="flex h-5 w-5 items-center justify-center rounded-md border border-ui-info bg-ui-info text-ui-info-foreground">
                <Check className="h-3.5 w-3.5" />
              </div>
            ) : (
              <Checkbox
                checked={isSelected}
                onCheckedChange={onToggleSelect}
                aria-label={`Select ${candidate.full_name}`}
                className="h-5 w-5 rounded-md border-ui-border-medium data-[state=checked]:border-ui-info data-[state=checked]:bg-ui-info"
              />
            )}
          </div>

          {candidate.profile_pic_url ? (
            <img
              src={candidate.profile_pic_url}
              alt={candidate.full_name}
              className="h-11 w-11 rounded-full object-cover"
              onError={(event) => {
                (event.target as HTMLImageElement).style.display = "none";
                (event.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
              }}
            />
          ) : null}
          <div
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[15px] font-semibold",
              getAvatarToneClass(candidate.full_name),
              candidate.profile_pic_url ? "hidden" : "flex",
            )}
          >
            {getInitials(candidate.full_name)}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-[16px] font-semibold text-ui-text-primary">{cleanDisplayName(candidate.full_name)}</h3>
              {candidate.linkedin_url && (
                <a
                  href={normalizeLinkedInUrl(candidate.linkedin_url) ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-linkedin-foreground transition-opacity hover:opacity-80"
                  onClick={(event) => event.stopPropagation()}
                  aria-label={`Open ${cleanDisplayName(candidate.full_name)} on LinkedIn`}
                >
                  <LinkedInMark className="h-3.5 w-3.5" />
                </a>
              )}
            </div>

            <p className="mt-1 text-[15px] text-ui-text-secondary">{candidate.title || "—"}</p>

            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-ui-text-tertiary">
              {candidate.current_employer && (
                <span className="flex min-w-0 items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{candidate.current_employer}</span>
                </span>
              )}
              {candidate.location && (
                <span className="flex min-w-0 items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{candidate.location}</span>
                </span>
              )}
            </div>

            {visibleSkills.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-2 xl:hidden">
                {visibleSkills.map((skill) => (
                  <span
                    key={skill}
                    className="rounded-[4px] bg-tag px-2.5 py-1 text-[13px] leading-none text-tag-foreground"
                  >
                    {skill}
                  </span>
                ))}
                {extraSkills > 0 && <span className="text-[13px] text-ui-text-muted">+{extraSkills}</span>}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 xl:justify-end">
          <div className="hidden max-w-[280px] shrink-0 flex-wrap items-center justify-end gap-2 xl:flex">
            {visibleSkills.map((skill) => (
              <span key={skill} className="rounded-[4px] bg-tag px-2.5 py-1 text-[13px] leading-none text-tag-foreground">
                {skill}
              </span>
            ))}
            {extraSkills > 0 && <span className="text-[13px] text-ui-text-muted">+{extraSkills}</span>}
          </div>

          <div className="flex min-w-[110px] shrink-0 flex-col items-start gap-2 text-left sm:items-end sm:text-right">
            {salary && (
              <span className="rounded-[4px] bg-salary px-2.5 py-1 text-[14px] font-medium leading-none text-salary-foreground">
                {salary}
              </span>
            )}
            {(candidate.years_experience ?? 0) > 0 && (
              <span className="text-[13px] text-ui-text-muted">{candidate.years_experience} yrs exp</span>
            )}
            {candidate.has_contact_info && (
              <span className="inline-flex items-center gap-1.5 text-[13px] text-contact-foreground">
                <Mail className="h-3.5 w-3.5" />
                Contact available
              </span>
            )}
          </div>

          <ChevronRight className="h-4 w-4 shrink-0 text-ui-text-muted" />
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
  onToggleSelect,
  onToggleSelectAll,
  onOpenCandidate,
  onSaveBulk,
  onEditFilters,
  onNewSearch,
  onSubmitQuery,
  page = 1,
  pageSize = 15,
  onPageChange,
  isSaving = false,
}: SearchResultsProps) {
  const [queryDraft, setQueryDraft] = useState(query);
  const totalPages = Math.ceil(total / pageSize);
  const selectableCount = candidates.filter((candidate) => !savedIds.has(candidate.id)).length;

  useEffect(() => {
    setQueryDraft(query);
  }, [query]);

  if (candidates.length === 0) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center px-4 text-center">
        <div className="mb-5 rounded-full bg-ui-surface-subtle p-6">
          <SearchX className="h-10 w-10 text-ui-text-muted" />
        </div>
        <h3 className="mb-2 text-[20px] font-bold text-ui-text-primary">No results found</h3>
        <p className="mb-6 max-w-sm text-[15px] text-ui-text-tertiary">
          Try broadening your search by removing some filters or expanding your location.
        </p>
        {onEditFilters && (
          <Button variant="outline" onClick={onEditFilters} className="h-11 border-ui-border-medium px-5">
            <SlidersHorizontal className="h-4 w-4" />
            Edit Criteria
          </Button>
        )}
      </div>
    );
  }

  const unsavedSelected = [...selected].filter((id) => !savedIds.has(id));
  const allSelectableSelected = selectableCount > 0 && unsavedSelected.length === selectableCount;

  return (
    <div className="space-y-4">
      <form
        className="relative"
        onSubmit={(event) => {
          event.preventDefault();
          if (!queryDraft.trim() || !onSubmitQuery) return;
          onSubmitQuery(queryDraft.trim());
        }}
      >
        <Search className="pointer-events-none absolute left-5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-ui-text-muted" />
        <Input
          value={queryDraft}
          onChange={(event) => setQueryDraft(event.target.value)}
          placeholder="Search healthcare professionals"
          className="h-14 rounded-[10px] border-ui-border-medium bg-ui-surface-subtle pl-14 pr-14 text-base shadow-none"
        />
        <button
          type="submit"
          className="absolute right-4 top-1/2 -translate-y-1/2 text-ui-text-muted transition-colors hover:text-ui-info"
          aria-label="Run search"
        >
          <Search className="h-5 w-5" />
        </button>
      </form>

      <div className="flex flex-col gap-4 border-b border-ui-border-light pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-end gap-2">
            <span className="text-[22px] font-bold leading-none text-ui-text-primary">{total.toLocaleString()}</span>
            <span className="text-[15px] text-ui-text-tertiary">results</span>
          </div>
          {selected.size > 0 && (
            <span className="rounded-md bg-linkedin px-3 py-1 text-[14px] font-medium text-ui-info">
              {selected.size} selected
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="mr-2 inline-flex items-center gap-2 text-sm text-ui-text-tertiary">
            <Checkbox
              checked={allSelectableSelected}
              onCheckedChange={onToggleSelectAll}
              aria-label="Select all candidates"
              className="h-5 w-5 rounded-md border-ui-border-medium data-[state=checked]:border-ui-info data-[state=checked]:bg-ui-info"
            />
            Select all
          </label>

          {unsavedSelected.length > 0 && (
            <Button onClick={onSaveBulk} disabled={isSaving} className="h-10 bg-ui-info px-4 text-[14px] text-ui-info-foreground hover:bg-ui-info/90">
              {isSaving ? "Saving…" : `Save ${unsavedSelected.length} to ${projectName ? `"${projectName}"` : "Project"}`}
            </Button>
          )}

          {onEditFilters && (
            <Button
              variant="outline"
              onClick={onEditFilters}
              className="h-10 border-ui-border-medium bg-card px-4 text-[14px] text-ui-text-secondary hover:bg-ui-surface-hover"
            >
              <SlidersHorizontal className="h-4 w-4" />
              Edit Criteria
            </Button>
          )}

          {onNewSearch && (
            <Button
              variant="outline"
              onClick={onNewSearch}
              className="h-10 border-ui-border-medium bg-card px-4 text-[14px] text-ui-text-secondary hover:bg-ui-surface-hover"
            >
              <RotateCcw className="h-4 w-4" />
              New Search
            </Button>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-ui-border-light bg-card">
        {candidates.map((candidate) => (
          <CandidateRow
            key={candidate.id}
            candidate={candidate}
            isSelected={selected.has(candidate.id)}
            isSaved={savedIds.has(candidate.id)}
            onToggleSelect={() => onToggleSelect(candidate.id)}
            onOpenCandidate={() => onOpenCandidate(candidate)}
          />
        ))}
      </div>

      {totalPages > 1 && onPageChange && (
        <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-ui-text-tertiary">
            Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total.toLocaleString()}
          </p>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
              className="h-10 border-ui-border-medium px-4 text-[14px] text-ui-text-secondary hover:bg-ui-surface-hover"
            >
              <ChevronLeft className="h-4 w-4" />
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
                  onClick={() => onPageChange(pageNumber)}
                  className={cn(
                    "h-10 w-10 border-ui-border-medium p-0 text-[14px] hover:bg-ui-surface-hover",
                    isCurrentPage && "border-ui-info bg-linkedin text-ui-info hover:bg-linkedin",
                  )}
                >
                  {pageNumber}
                </Button>
              );
            })}

            <Button
              variant="outline"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
              className="h-10 border-ui-border-medium px-4 text-[14px] text-ui-text-secondary hover:bg-ui-surface-hover"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
