import { useState } from "react";
import { format } from "date-fns";
import { X, ChevronDown, Check, Calendar as CalendarIcon } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { getFilterMeta, type ContactFilter } from "./AddFilterButton";
import { ALL_PROJECTS, ALL_TAGS } from "@/data/mock-contacts";
import type { DateRange } from "react-day-picker";

const SKILLS_FALLBACK = [
  "BLS", "ACLS", "PALS", "EMR (Epic)", "Triage",
  "Critical Care", "Telemetry", "Wound Care", "IV Therapy", "Pediatrics",
];

export interface FilterValue {
  filter: ContactFilter;
  multi?: string[];
  text?: string;
  range?: DateRange;
  bool?: boolean;
}

export function FilterChip({
  value,
  onChange,
  onRemove,
}: {
  value: FilterValue;
  onChange: (v: FilterValue) => void;
  onRemove: () => void;
}) {
  const meta = getFilterMeta(value.filter);
  const [open, setOpen] = useState(false);

  const summary = renderSummary(value);

  return (
    <span className="inline-flex items-center rounded-full border border-border bg-secondary/50 text-[11px] overflow-hidden">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button className="flex items-center gap-1 px-2 py-1 hover:bg-secondary transition">
            <span className="font-medium text-foreground/80">{value.filter}</span>
            <span className="text-muted-foreground">·</span>
            <span className="text-foreground max-w-[180px] truncate">{summary}</span>
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 p-3">
          <FilterEditor value={value} onChange={onChange} />
        </PopoverContent>
      </Popover>
      <button
        onClick={onRemove}
        className="px-1.5 py-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition"
        aria-label={`Remove ${value.filter} filter`}
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

function renderSummary(v: FilterValue): string {
  const meta = getFilterMeta(v.filter);
  switch (meta.kind) {
    case "multi": {
      const arr = v.multi ?? [];
      if (arr.length === 0) return "any";
      if (arr.length <= 2) return arr.join(", ");
      return `${arr.length} selected`;
    }
    case "text":
      return v.text?.trim() ? `"${v.text}"` : "any";
    case "dateRange": {
      const r = v.range;
      if (!r?.from && !r?.to) return "any";
      if (r.from && r.to) return `${format(r.from, "MMM d")} – ${format(r.to, "MMM d")}`;
      if (r.from) return `from ${format(r.from, "MMM d")}`;
      return "any";
    }
    case "boolean":
      return v.bool === undefined ? "any" : v.bool ? "true" : "false";
  }
}

function FilterEditor({
  value,
  onChange,
}: {
  value: FilterValue;
  onChange: (v: FilterValue) => void;
}) {
  const meta = getFilterMeta(value.filter);

  if (meta.kind === "multi") {
    let options = meta.options ?? [];
    if (value.filter === "Project") options = ALL_PROJECTS;
    else if (value.filter === "Tags") options = ALL_TAGS;
    else if (value.filter === "Skills") options = SKILLS_FALLBACK;

    const selected = new Set(value.multi ?? []);
    const toggle = (opt: string) => {
      const next = new Set(selected);
      if (next.has(opt)) next.delete(opt);
      else next.add(opt);
      onChange({ ...value, multi: Array.from(next) });
    };

    return (
      <div className="space-y-1.5">
        <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium mb-1">
          {value.filter}
        </p>
        <div className="max-h-56 overflow-y-auto -mx-1">
          {options.length === 0 ? (
            <p className="text-xs text-muted-foreground italic px-2 py-3">
              No options available.
            </p>
          ) : (
            options.map((opt) => {
              const isOn = selected.has(opt);
              return (
                <button
                  key={opt}
                  onClick={() => toggle(opt)}
                  className={cn(
                    "w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-secondary transition text-left",
                    isOn && "bg-secondary"
                  )}
                >
                  <span className="truncate">{opt}</span>
                  {isOn && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                </button>
              );
            })
          )}
        </div>
        {selected.size > 0 && (
          <button
            onClick={() => onChange({ ...value, multi: [] })}
            className="text-[11px] text-muted-foreground hover:text-foreground hover:underline"
          >
            Clear
          </button>
        )}
      </div>
    );
  }

  if (meta.kind === "text") {
    return (
      <div className="space-y-2">
        <Label className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
          {value.filter}
        </Label>
        <Input
          autoFocus
          value={value.text ?? ""}
          onChange={(e) => onChange({ ...value, text: e.target.value })}
          placeholder={`Filter by ${value.filter.toLowerCase()}…`}
          className="h-8 text-sm"
        />
      </div>
    );
  }

  if (meta.kind === "dateRange") {
    return (
      <div className="space-y-2">
        <Label className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium flex items-center gap-1">
          <CalendarIcon className="h-3 w-3" />
          {value.filter}
        </Label>
        <Calendar
          mode="range"
          selected={value.range}
          onSelect={(range) => onChange({ ...value, range })}
          numberOfMonths={1}
          className={cn("p-0 pointer-events-auto")}
        />
        {(value.range?.from || value.range?.to) && (
          <button
            onClick={() => onChange({ ...value, range: undefined })}
            className="text-[11px] text-muted-foreground hover:text-foreground hover:underline"
          >
            Clear dates
          </button>
        )}
      </div>
    );
  }

  // boolean
  return (
    <div className="space-y-3">
      <Label className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
        {value.filter}
      </Label>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onChange({ ...value, bool: undefined })}
          className={cn(
            "px-2 py-1 rounded-md text-xs border transition",
            value.bool === undefined
              ? "bg-secondary border-border text-foreground"
              : "border-transparent text-muted-foreground hover:bg-secondary"
          )}
        >
          Any
        </button>
        <button
          onClick={() => onChange({ ...value, bool: true })}
          className={cn(
            "px-2 py-1 rounded-md text-xs border transition",
            value.bool === true
              ? "bg-success/15 border-success/30 text-success"
              : "border-transparent text-muted-foreground hover:bg-secondary"
          )}
        >
          True
        </button>
        <button
          onClick={() => onChange({ ...value, bool: false })}
          className={cn(
            "px-2 py-1 rounded-md text-xs border transition",
            value.bool === false
              ? "bg-destructive/10 border-destructive/30 text-destructive"
              : "border-transparent text-muted-foreground hover:bg-secondary"
          )}
        >
          False
        </button>
      </div>
    </div>
  );
}
