import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  MapPin,
  Building2,
  Clock,
  ExternalLink,
  FolderPlus,
  SearchX,
  SlidersHorizontal,
  Mail,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Sparkles,
  Signal,
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
}

interface SearchResultsProps {
  candidates: Candidate[];
  total: number;
  selected: Set<string>;
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
}

function formatTenure(months: number | null) {
  if (!months) return "—";
  if (months < 12) return `${months}mo`;
  const years = Math.floor(months / 12);
  const remaining = months % 12;
  return remaining > 0 ? `${years}y ${remaining}mo` : `${years}y`;
}

function AvailabilityIndicator({ available }: { available: boolean }) {
  return available ? (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
      <Check className="h-3 w-3" />
      Available
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <X className="h-3 w-3" />
      Unavailable
    </span>
  );
}

function MatchScoreIndicator({ score }: { score: number }) {
  const getColor = () => {
    if (score >= 80) return { bar: "bg-primary", text: "text-primary", label: "Excellent" };
    if (score >= 60) return { bar: "bg-primary/70", text: "text-primary", label: "Good" };
    if (score >= 40) return { bar: "bg-amber-500", text: "text-amber-600", label: "Fair" };
    return { bar: "bg-muted-foreground/40", text: "text-muted-foreground", label: "Low" };
  };
  const { bar, text, label } = getColor();

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2 min-w-[80px]">
            <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
              <div className={`h-full rounded-full ${bar} transition-all`} style={{ width: `${score}%` }} />
            </div>
            <span className={`text-[11px] font-semibold tabular-nums ${text}`}>{score}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          <p className="font-medium">{label} match ({score}/100)</p>
          <p className="text-muted-foreground">Based on title, location & data completeness</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function SearchResults({
  candidates,
  total,
  selected,
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

  const isPreviewMode = candidates.some((c) => c.preview);

  return (
    <div className="space-y-0">
      {/* Toolbar */}
      <div className="flex items-center justify-between pb-4 border-b border-border mb-4">
        <div className="flex items-center gap-4">
          <div>
            <h2 className="text-lg font-display font-semibold leading-tight">
              {total.toLocaleString()} Results
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)}
            </p>
          </div>
          {isPreviewMode && (
            <Badge variant="outline" className="text-[10px] px-2 py-0.5 text-amber-600 border-amber-300 bg-amber-50 font-medium">
              <Sparkles className="h-2.5 w-2.5 mr-1" />
              Preview Mode
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {selected.size > 0 && (
            <Button size="sm" onClick={onSaveBulk} className="h-8">
              <FolderPlus className="h-3.5 w-3.5 mr-1.5" />
              Save {selected.size} to Project
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

      {/* Table */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="w-[44px] pl-4">
                <Checkbox
                  checked={selected.size === candidates.length && candidates.length > 0}
                  onCheckedChange={onToggleSelectAll}
                />
              </TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <span className="flex items-center gap-1"><Signal className="h-3 w-3" /> Match</span>
              </TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Name</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Title</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Employer</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Location</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tenure</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Skills</TableHead>
              <TableHead className="w-[72px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {candidates.map((c, i) => (
              <TableRow
                key={c.id}
                className={`group cursor-pointer transition-colors hover:bg-primary/5 ${i % 2 === 0 ? "bg-card" : "bg-muted/10"}`}
                onClick={() => onOpenCandidate(c)}
              >
                <TableCell className="pl-4" onClick={(e) => e.stopPropagation()}>
                  <Checkbox checked={selected.has(c.id)} onCheckedChange={() => onToggleSelect(c.id)} />
                </TableCell>
                <TableCell>
                  <MatchScoreIndicator score={c.match_score ?? 50} />
                </TableCell>
                <TableCell>
                  <div className="min-w-[140px]">
                    <p className="text-sm font-medium text-foreground">{c.full_name}</p>
                    {c.preview ? (
                      c.has_email && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-primary font-medium mt-0.5">
                          <Mail className="h-2.5 w-2.5" /> Email available
                        </span>
                      )
                    ) : (
                      c.email && <p className="text-[11px] text-muted-foreground truncate max-w-[180px] mt-0.5">{c.email}</p>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <span className="text-sm text-foreground/80 leading-snug line-clamp-2">{c.title || "—"}</span>
                </TableCell>
                <TableCell>
                  {c.current_employer ? (
                    <div className="flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-sm truncate max-w-[160px]">{c.current_employer}</span>
                    </div>
                  ) : <span className="text-sm text-muted-foreground">—</span>}
                </TableCell>
                <TableCell>
                  {c.location ? (
                    <div className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-sm">{c.location}</span>
                    </div>
                  ) : <span className="text-sm text-muted-foreground">—</span>}
                </TableCell>
                <TableCell>
                  {c.preview ? (
                    <AvailabilityIndicator available={!!c.has_experience} />
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-sm">{formatTenure(c.avg_tenure_months)}</span>
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  {c.preview ? (
                    <AvailabilityIndicator available={!!c.has_skills} />
                  ) : (
                    <div className="flex flex-wrap gap-1 max-w-[200px]">
                      {c.skills.slice(0, 2).map((skill) => (
                        <Badge key={skill} variant="secondary" className="text-[10px] px-1.5 py-0 font-normal">{skill}</Badge>
                      ))}
                      {c.skills.length > 2 && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal">+{c.skills.length - 2}</Badge>
                      )}
                    </div>
                  )}
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-0.5">
                    <button
                      onClick={() => onSaveSingle(c)}
                      className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors opacity-0 group-hover:opacity-100"
                      title="Save to project"
                    >
                      <FolderPlus className="h-3.5 w-3.5" />
                    </button>
                    {c.linkedin_url && (
                      <a
                        href={c.linkedin_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-md text-muted-foreground hover:text-primary transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && onPageChange && (
        <div className="flex items-center justify-between pt-4">
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
            {/* Page number pills */}
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
