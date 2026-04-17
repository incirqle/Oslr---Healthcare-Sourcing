import { X, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export type ActiveFilter = {
  /** Stable id used to remove the filter. */
  id: string;
  /** Display label. */
  label: string;
  /** Group/category for icon and grouping. */
  group: "Specialty" | "Location" | "Company" | "Title" | "Keyword" | "Experience";
  /** True if user typed it; false if AI added it. */
  fromUser: boolean;
};

interface ActiveFilterBarProps {
  filters: ActiveFilter[];
  onRemove: (id: string) => void;
  onAddFilter?: () => void;
}

export function ActiveFilterBar({ filters, onRemove, onAddFilter }: ActiveFilterBarProps) {
  if (filters.length === 0 && !onAddFilter) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-border/50 bg-card/40 px-3 py-2">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70 mr-1">
        Filters
      </span>
      {filters.map((f) => (
        <span
          key={f.id}
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs transition-colors",
            f.fromUser
              ? "bg-primary/15 border border-primary/30 text-foreground"
              : "border border-dashed border-border bg-transparent text-muted-foreground",
          )}
        >
          <span className="text-[10px] uppercase tracking-wide opacity-60">{f.group}</span>
          <span className="font-medium">{f.label}</span>
          <button
            type="button"
            onClick={() => onRemove(f.id)}
            className="ml-0.5 h-4 w-4 rounded-full hover:bg-foreground/10 flex items-center justify-center transition-colors"
            aria-label={`Remove ${f.label} filter`}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      {onAddFilter && (
        <button
          type="button"
          onClick={onAddFilter}
          className="inline-flex items-center gap-1 rounded-full border border-dashed border-border/70 px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
        >
          <Plus className="h-3 w-3" />
          Add filter
        </button>
      )}
    </div>
  );
}
