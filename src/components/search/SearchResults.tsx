import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  MapPin,
  Building2,
  ExternalLink,
  FolderPlus,
  SearchX,
  SlidersHorizontal,
  Mail,
  Check,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Sparkles,
  Loader2,
  DollarSign,
  Clock,
  Linkedin,
  Phone,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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
  // V2 enriched fields
  profile_pic_url?: string | null;
  inferred_salary?: string | null;
  years_experience?: number;
  clinical_skills?: string[];
  has_contact_info?: boolean;
  summary?: string | null;
  raw?: Record<string, unknown>;
}

interface SearchResultsProps {
  candidates: Candidate[];
  total: number;
  selected: Set<string>;
  savedIds?: Set<string>;
  projectName?: string;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  onOpenCandidate: (candidate: Candidate) => void;
  onSaveSingle: (candidate: Candidate) => void;
  onSaveBulk: () => void;
  onEditFilters?: () => void;
  onNewSearch?: () => void;
  page?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  isSaving?: boolean;
}

function formatSalary(salary: string | null | undefined): string | null {
  if (!salary) return null;
  if (salary.startsWith(">")) return "$250K+";
  if (salary.startsWith("<")) return "< $20K";
  const parts = salary.split("-").map(s => s.trim().replace(/,/g, ""));
  if (parts.length === 2) {
    const low = Math.round(parseInt(parts[0]) / 1000);
    const high = Math.round(parseInt(parts[1]) / 1000);
    if (!isNaN(low) && !isNaN(high)) return `$${low}K – $${high}K`;
  }
  return salary;
}

function getInitials(name: string): string {
  return name.split(/\s+/).map(w => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

function getAvatarColor(name: string): string {
  const colors = [
    "bg-blue-100 text-blue-700",
    "bg-emerald-100 text-emerald-700",
    "bg-purple-100 text-purple-700",
    "bg-amber-100 text-amber-700",
    "bg-rose-100 text-rose-700",
    "bg-cyan-100 text-cyan-700",
    "bg-indigo-100 text-indigo-700",
    "bg-teal-100 text-teal-700",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function CandidateCard({
  candidate,
  isSelected,
  isSaved,
  onToggleSelect,
  onOpenCandidate,
  onSaveSingle,
  isSaving,
}: {
  candidate: Candidate;
  isSelected: boolean;
  isSaved: boolean;
  onToggleSelect: () => void;
  onOpenCandidate: () => void;
  onSaveSingle: () => void;
  isSaving: boolean;
}) {
  const salary = formatSalary(candidate.inferred_salary);
  const skills = candidate.clinical_skills?.length ? candidate.clinical_skills : candidate.skills;

  return (
    <div
      className="group relative bg-card border border-border rounded-xl p-4 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer"
      onClick={onOpenCandidate}
    >
      {/* Select checkbox */}
      <div className="absolute top-3 left-3 z-10" onClick={(e) => e.stopPropagation()}>
        {isSaved ? (
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex h-5 w-5 items-center justify-center rounded-md bg-primary/10">
                  <Check className="h-3.5 w-3.5 text-primary" />
                </div>
              </TooltipTrigger>
              <TooltipContent side="right" className="text-xs">Already in project</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          <Checkbox checked={isSelected} onCheckedChange={onToggleSelect} />
        )}
      </div>

      {/* Quick actions - top right */}
      <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
        {!isSaved && (
          <button
            onClick={onSaveSingle}
            disabled={isSaving}
            className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
            title="Save to project"
          >
            <FolderPlus className="h-3.5 w-3.5" />
          </button>
        )}
        {candidate.linkedin_url && (
          <a
            href={candidate.linkedin_url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded-md hover:bg-[#0A66C2]/10 transition-colors"
            title="View LinkedIn"
          >
            <Linkedin className="h-3.5 w-3.5 text-[#0A66C2]" />
          </a>
        )}
      </div>

      <div className="flex gap-3.5 pl-6">
        {/* Avatar */}
        {candidate.profile_pic_url ? (
          <img
            src={candidate.profile_pic_url}
            alt={candidate.full_name}
            className="h-12 w-12 rounded-full object-cover shrink-0 border border-border"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
              (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
            }}
          />
        ) : null}
        <div className={`h-12 w-12 rounded-full shrink-0 flex items-center justify-center text-sm font-semibold ${getAvatarColor(candidate.full_name)} ${candidate.profile_pic_url ? "hidden" : ""}`}>
          {getInitials(candidate.full_name)}
        </div>

        {/* Main info */}
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-foreground truncate">{candidate.full_name}</h3>
          <p className="text-xs text-muted-foreground truncate mt-0.5">{candidate.title || "—"}</p>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-muted-foreground">
            {candidate.current_employer && (
              <span className="flex items-center gap-1 truncate max-w-[180px]">
                <Building2 className="h-3 w-3 shrink-0" />
                {candidate.current_employer}
              </span>
            )}
            {candidate.location && (
              <span className="flex items-center gap-1 truncate">
                <MapPin className="h-3 w-3 shrink-0" />
                {candidate.location}
              </span>
            )}
            {(candidate.years_experience ?? 0) > 0 && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3 shrink-0" />
                {candidate.years_experience} yrs
              </span>
            )}
          </div>

          {/* Badges row */}
          <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
            {salary && (
              <Badge variant="outline" className="text-[10px] px-2 py-0.5 bg-emerald-50 text-emerald-700 border-emerald-200 font-medium">
                <DollarSign className="h-2.5 w-2.5 mr-0.5" />
                {salary}
              </Badge>
            )}
            {candidate.has_contact_info && (
              <Badge variant="outline" className="text-[10px] px-2 py-0.5 bg-blue-50 text-blue-600 border-blue-200 font-medium">
                <Mail className="h-2.5 w-2.5 mr-0.5" />
                Contact available
              </Badge>
            )}
            {candidate.linkedin_url && (
              <Badge variant="outline" className="text-[10px] px-2 py-0.5 bg-sky-50 text-[#0A66C2] border-sky-200 font-medium">
                <Linkedin className="h-2.5 w-2.5 mr-0.5" />
                LinkedIn
              </Badge>
            )}
          </div>

          {/* Skills */}
          {skills && skills.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2.5">
              {skills.slice(0, 3).map((skill) => (
                <Badge key={skill} variant="secondary" className="text-[10px] px-1.5 py-0 font-normal">{skill}</Badge>
              ))}
              {skills.length > 3 && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal">+{skills.length - 3}</Badge>
              )}
            </div>
          )}

          {/* AI Summary snippet */}
          {candidate.summary && (
            <p className="text-[11px] text-muted-foreground/80 italic mt-2 line-clamp-2">{candidate.summary}</p>
          )}
        </div>
      </div>
    </div>
  );
}

export function SearchResults({
  candidates,
  total,
  selected,
  savedIds = new Set(),
  projectName,
  onToggleSelect,
  onToggleSelectAll,
  onOpenCandidate,
  onSaveSingle,
  onSaveBulk,
  onEditFilters,
  onNewSearch,
  page = 1,
  pageSize = 15,
  onPageChange,
  isSaving = false,
}: SearchResultsProps) {
  const totalPages = Math.ceil(total / pageSize);

  if (candidates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4">
        <div className="rounded-full bg-muted p-6 mb-5">
          <SearchX className="h-10 w-10 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-display font-semibold mb-2">No results found</h3>
        <p className="text-sm text-muted-foreground max-w-sm mb-6">
          Try broadening your search by removing some filters or expanding your location.
        </p>
        {onEditFilters && (
          <Button variant="outline" onClick={onEditFilters}>
            <SlidersHorizontal className="h-4 w-4 mr-2" />
            Edit Filters
          </Button>
        )}
      </div>
    );
  }

  const unsavedSelected = [...selected].filter((id) => !savedIds.has(id));

  return (
    <div className="space-y-0">
      {/* Toolbar */}
      <div className="flex items-center justify-between pb-4 border-b border-border mb-5">
        <div className="flex items-center gap-4">
          <div>
            <h2 className="text-lg font-display font-semibold leading-tight">
              {total.toLocaleString()} Results
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 mr-2" onClick={e => e.stopPropagation()}>
            <Checkbox
              checked={selected.size === candidates.length && candidates.length > 0}
              onCheckedChange={onToggleSelectAll}
            />
            <span className="text-xs text-muted-foreground">Select all</span>
          </div>
          {unsavedSelected.length > 0 && (
            <Button size="sm" onClick={onSaveBulk} className="h-8" disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <FolderPlus className="h-3.5 w-3.5 mr-1.5" />
              )}
              Save {unsavedSelected.length} to {projectName ? `"${projectName}"` : "Project"}
            </Button>
          )}
          {onEditFilters && (
            <Button size="sm" variant="outline" onClick={onEditFilters} className="h-8">
              <SlidersHorizontal className="h-3.5 w-3.5 mr-1.5" />
              Edit Criteria
            </Button>
          )}
          {onNewSearch && (
            <Button size="sm" variant="ghost" onClick={onNewSearch} className="h-8 text-muted-foreground">
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
              New Search
            </Button>
          )}
        </div>
      </div>

      {/* Card Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {candidates.map((c) => {
          const isSaved = savedIds.has(c.id);
          return (
            <CandidateCard
              key={c.id}
              candidate={c}
              isSelected={selected.has(c.id)}
              isSaved={isSaved}
              onToggleSelect={() => onToggleSelect(c.id)}
              onOpenCandidate={() => onOpenCandidate(c)}
              onSaveSingle={() => onSaveSingle(c)}
              isSaving={isSaving}
            />
          );
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && onPageChange && (
        <div className="flex items-center justify-between pt-6">
          <p className="text-xs text-muted-foreground">
            Page {page} of {totalPages.toLocaleString()}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
              className="h-8 px-3"
            >
              <ChevronLeft className="h-3.5 w-3.5 mr-1" />
              Previous
            </Button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (page <= 3) {
                pageNum = i + 1;
              } else if (page >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = page - 2 + i;
              }
              return (
                <Button
                  key={pageNum}
                  variant={pageNum === page ? "default" : "ghost"}
                  size="sm"
                  className="h-8 w-8 p-0 text-xs"
                  onClick={() => onPageChange(pageNum)}
                >
                  {pageNum}
                </Button>
              );
            })}
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
              className="h-8 px-3"
            >
              Next
              <ChevronRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
