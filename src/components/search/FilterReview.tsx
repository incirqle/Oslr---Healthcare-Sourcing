/**
 * FilterReview folded into QueryReadback (docs/oslr-criteria-ranking-spec.md
 * 9.1). This file keeps the ParsedFilters type other modules import, and a
 * FilterReview wrapper with the same props so nothing a user could do here
 * (see the chips, edit, reset, run) goes away.
 */
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QueryReadback } from "./QueryReadback";

export interface ParsedFilters {
  job_titles: string[];
  locations: string[];
  companies: string[];
  keywords: string[];
  experience_years?: number | null;
  specialties: string[];
  /** License-class population the engine gates on ("surgeon", "nurse"…). */
  role_class?: string | null;
  /** Who signs the paycheck: "private_practice" | "hospital_employed" | null (any). */
  employment_model?: string | null;
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
  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4">
      <QueryReadback
        query={query}
        filters={filters}
        required={[]}
        ranking={[]}
        cantCheck={[]}
        keptCount={total}
        onOpenFilter={onEdit}
        onOpenCriteria={onEdit}
        onReset={onReset}
      />
      <div className="flex justify-center">
        <Button onClick={() => onRunSearch()} disabled={loading} className="h-11 rounded-full px-8">
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Run Search
        </Button>
      </div>
    </div>
  );
}
