import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, SlidersHorizontal, RotateCcw, Loader2 } from "lucide-react";

export interface ParsedFilters {
  job_titles: string[];
  locations: string[];
  companies: string[];
  keywords: string[];
  experience_years?: number | null;
  specialties: string[];
}

interface FilterReviewProps {
  query: string;
  filters: ParsedFilters;
  total: number;
  onEdit: () => void;
  onReset: () => void;
  onRunSearch: () => void;
  loading: boolean;
}

export function FilterReview({ query, filters, total, onEdit, onReset, onRunSearch, loading }: FilterReviewProps) {
  const allTags: { label: string; type: string }[] = [
    ...filters.job_titles.map((t) => ({ label: t, type: "title" })),
    ...filters.companies.map((c) => ({ label: c, type: "company" })),
    ...filters.specialties.map((s) => ({ label: s, type: "specialty" })),
    ...filters.keywords.map((k) => ({ label: k, type: "keyword" })),
  ];

  const locationTags = filters.locations.map((l) => l);

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] px-4 max-w-2xl mx-auto">
      {/* User query bubble */}
      <div className="self-end mb-6">
        <div className="rounded-2xl bg-secondary border border-border px-5 py-3 text-sm text-foreground">
          {query}
        </div>
      </div>

      {/* AI response */}
      <div className="self-start flex gap-3 w-full">
        <div className="shrink-0 h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center mt-1">
          <Search className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 rounded-2xl border border-border bg-card p-5 shadow-sm">
          <p className="text-sm text-foreground mb-3">
            I've set these <SlidersHorizontal className="inline h-3.5 w-3.5 mx-0.5" />
            <span className="text-primary font-medium"> filters</span> based on what you're looking for{" "}
            <span className="font-semibold">({total.toLocaleString()} matches)</span>
          </p>

          <div className="flex flex-wrap gap-1.5 mb-1">
            {allTags.map((tag) => (
              <Badge key={tag.label} variant="secondary" className="text-xs px-2.5 py-0.5 rounded-md font-normal">
                {tag.label}
              </Badge>
            ))}
            {locationTags.length > 0 && (
              <>
                <span className="text-xs text-muted-foreground self-center mx-0.5">in</span>
                {locationTags.map((loc) => (
                  <Badge key={loc} variant="secondary" className="text-xs px-2.5 py-0.5 rounded-md font-normal">
                    {loc}
                  </Badge>
                ))}
              </>
            )}
            {filters.experience_years && (
              <Badge variant="secondary" className="text-xs px-2.5 py-0.5 rounded-md font-normal">
                {filters.experience_years}+ years
              </Badge>
            )}
          </div>

          <button onClick={onEdit} className="text-xs text-primary font-medium hover:underline mt-2 inline-block">
            Edit
          </button>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 mt-8">
        <button
          onClick={onReset}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset Search
        </button>
        <Button onClick={() => onRunSearch()} disabled={loading} className="rounded-full px-8 h-11">
          {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
          Run Search
        </Button>
      </div>
    </div>
  );
}
