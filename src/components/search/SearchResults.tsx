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
import { MapPin, Building2, Clock, ExternalLink, FolderPlus, SearchX, SlidersHorizontal, Mail, Phone, Check, X } from "lucide-react";

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
    <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
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
}: SearchResultsProps) {
  if (candidates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4">
        <div className="rounded-full bg-muted p-6 mb-5">
          <SearchX className="h-10 w-10 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-display font-semibold mb-2">No results found</h3>
        <p className="text-sm text-muted-foreground max-w-sm mb-1">
          We couldn't find any professionals matching your current filters.
        </p>
        <p className="text-sm text-muted-foreground max-w-sm mb-6">
          Try broadening your search by removing some filters, using fewer job titles, or expanding your location.
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-display font-semibold">
            Results ({total.toLocaleString()} found)
          </h2>
          {isPreviewMode && (
            <Badge variant="outline" className="text-[10px] px-2 py-0.5 text-amber-600 border-amber-300 bg-amber-50">
              Preview Mode
            </Badge>
          )}
          {selected.size > 0 && (
            <Button size="sm" variant="outline" onClick={onSaveBulk}>
              <FolderPlus className="h-3.5 w-3.5 mr-1.5" />
              Save {selected.size} to Project
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-secondary/30">
              <TableHead className="w-[40px]">
                <Checkbox
                  checked={selected.size === candidates.length && candidates.length > 0}
                  onCheckedChange={onToggleSelectAll}
                />
              </TableHead>
              <TableHead className="font-medium">Name</TableHead>
              <TableHead className="font-medium">Title</TableHead>
              <TableHead className="font-medium">Employer</TableHead>
              <TableHead className="font-medium">Location</TableHead>
              <TableHead className="font-medium">Avg Tenure</TableHead>
              <TableHead className="font-medium">Skills</TableHead>
              <TableHead className="font-medium w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {candidates.map((c) => (
              <TableRow key={c.id} className="group hover:bg-secondary/20 cursor-pointer" onClick={() => onOpenCandidate(c)}>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Checkbox checked={selected.has(c.id)} onCheckedChange={() => onToggleSelect(c.id)} />
                </TableCell>
                <TableCell className="font-medium">
                  <div>
                    <p className="text-sm">{c.full_name}</p>
                    {c.preview ? (
                      c.has_email && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600">
                          <Mail className="h-2.5 w-2.5" /> Email available
                        </span>
                      )
                    ) : (
                      c.email && <p className="text-xs text-muted-foreground truncate max-w-[180px]">{c.email}</p>
                    )}
                  </div>
                </TableCell>
                <TableCell><span className="text-sm">{c.title || "—"}</span></TableCell>
                <TableCell>
                  {c.current_employer ? (
                    <div className="flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-sm truncate max-w-[150px]">{c.current_employer}</span>
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
                      {c.skills.slice(0, 3).map((skill) => (
                        <Badge key={skill} variant="secondary" className="text-[10px] px-1.5 py-0">{skill}</Badge>
                      ))}
                      {c.skills.length > 3 && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">+{c.skills.length - 3}</Badge>
                      )}
                    </div>
                  )}
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-1">
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
    </div>
  );
}
