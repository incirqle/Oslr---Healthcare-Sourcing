import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { MapPin, Briefcase, Building2, Clock, Tag, Hash, ChevronDown, X, DollarSign } from "lucide-react";
import type { ParsedFilters } from "./FilterReview";
import { ClinicalSalaryFilter } from "./ClinicalSalaryFilter";

interface FilterEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: ParsedFilters;
  onFiltersChange: (filters: ParsedFilters) => void;
  total: number;
}

function TagInput({
  tags,
  onChange,
  placeholder,
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder: string;
}) {
  const [value, setValue] = useState("");

  const addTag = () => {
    const trimmed = value.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
    }
    setValue("");
  };

  const removeTag = (tag: string) => {
    onChange(tags.filter((t) => t !== tag));
  };

  return (
    <div>
      <Input
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            addTag();
          }
        }}
        className="text-sm h-9"
      />
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs px-2 py-0.5 gap-1">
              {tag}
              <button onClick={() => removeTag(tag)} className="hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

interface FilterSectionProps {
  icon: React.ElementType;
  label: string;
  count: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function FilterSection({ icon: Icon, label, count, children, defaultOpen = false }: FilterSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="border border-border rounded-lg">
      <CollapsibleTrigger className="flex items-center justify-between w-full px-4 py-3 hover:bg-secondary/30 transition-colors">
        <div className="flex items-center gap-2.5">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{label}</span>
        </div>
        <div className="flex items-center gap-2">
          {count > 0 && (
            <span className="text-xs bg-secondary text-foreground rounded-full px-2 py-0.5 font-medium">
              {count}
            </span>
          )}
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent className="px-4 pb-4 pt-1">{children}</CollapsibleContent>
    </Collapsible>
  );
}

export function FilterEditor({ open, onOpenChange, filters, onFiltersChange, total }: FilterEditorProps) {
  const update = (key: keyof ParsedFilters, value: any) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="flex flex-row items-center justify-between pr-0">
          <SheetTitle className="text-lg">Edit Search Criteria</SheetTitle>
          <span className="text-sm text-muted-foreground">{total.toLocaleString()} matches</span>
        </SheetHeader>

        <div className="space-y-3 mt-6">
          <FilterSection icon={MapPin} label="Locations" count={filters.locations.length} defaultOpen={filters.locations.length > 0}>
            <p className="text-xs text-muted-foreground mb-2">Search by state, city, or radius from a city</p>
            <TagInput tags={filters.locations} onChange={(v) => update("locations", v)} placeholder="e.g., Dallas, Texas, California..." />
          </FilterSection>

          <FilterSection icon={Briefcase} label="Job Titles" count={filters.job_titles.length} defaultOpen={filters.job_titles.length > 0}>
            <p className="text-xs text-muted-foreground mb-2">Current job titles to match</p>
            <TagInput tags={filters.job_titles} onChange={(v) => update("job_titles", v)} placeholder="Start typing a job title..." />
          </FilterSection>

          <FilterSection icon={Building2} label="Company" count={filters.companies.length} defaultOpen={filters.companies.length > 0}>
            <p className="text-xs text-muted-foreground mb-2">Current or past employers</p>
            <TagInput tags={filters.companies} onChange={(v) => update("companies", v)} placeholder="Start typing a company name..." />
          </FilterSection>

          <FilterSection icon={Clock} label="Experience" count={filters.experience_years ? 1 : 0}>
            <p className="text-xs text-muted-foreground mb-2">Minimum years of experience</p>
            <Input
              type="number"
              placeholder="e.g., 5"
              value={filters.experience_years ?? ""}
              onChange={(e) => update("experience_years", e.target.value ? parseInt(e.target.value) : null)}
              className="text-sm h-9 w-32"
            />
          </FilterSection>

          <FilterSection icon={Tag} label="Specialties" count={filters.specialties.length} defaultOpen={filters.specialties.length > 0}>
            <p className="text-xs text-muted-foreground mb-2">Medical specialties or areas of focus</p>
            <TagInput tags={filters.specialties} onChange={(v) => update("specialties", v)} placeholder="Start typing a specialty..." />
          </FilterSection>

          <FilterSection icon={Hash} label="Keywords" count={filters.keywords.length} defaultOpen={filters.keywords.length > 0}>
            <p className="text-xs text-muted-foreground mb-2">Required skills, certifications, or keywords</p>
            <TagInput tags={filters.keywords} onChange={(v) => update("keywords", v)} placeholder="Start typing a keyword..." />
          </FilterSection>
        </div>
      </SheetContent>
    </Sheet>
  );
}
