import { Filter } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

export type FilterKind = "multi" | "text" | "dateRange" | "boolean";

export const CONTACT_FILTERS: { name: ContactFilter; kind: FilterKind; options?: string[] }[] = [
  { name: "Status", kind: "multi", options: ["New", "Shortlisted", "Email Sent", "Replied", "Hired", "Rejected"] },
  { name: "Owner", kind: "multi", options: ["Me", "Anyone on team"] },
  { name: "Project", kind: "multi" },
  { name: "Tags", kind: "multi" },
  { name: "Location", kind: "text" },
  { name: "Current Company", kind: "text" },
  { name: "Current + Past Company", kind: "text" },
  { name: "Job Title", kind: "text" },
  { name: "Current + Past Job Title", kind: "text" },
  { name: "School / University", kind: "text" },
  { name: "Major", kind: "text" },
  { name: "Skills", kind: "multi" },
  { name: "Date Contact Created", kind: "dateRange" },
  { name: "Date Last Enrolled in Campaign", kind: "dateRange" },
  { name: "Last Enrolled in Campaign by", kind: "multi", options: ["Me", "Anyone on team"] },
  { name: "Date Last Contacted", kind: "dateRange" },
  { name: "Date Last Replied", kind: "dateRange" },
  { name: "Contacted (true/false)", kind: "boolean" },
  { name: "Replied (true/false)", kind: "boolean" },
  { name: "Contact Info Revealed (true/false)", kind: "boolean" },
];

export type ContactFilter =
  | "Status"
  | "Owner"
  | "Project"
  | "Tags"
  | "Location"
  | "Current Company"
  | "Current + Past Company"
  | "Job Title"
  | "Current + Past Job Title"
  | "School / University"
  | "Major"
  | "Skills"
  | "Date Contact Created"
  | "Date Last Enrolled in Campaign"
  | "Last Enrolled in Campaign by"
  | "Date Last Contacted"
  | "Date Last Replied"
  | "Contacted (true/false)"
  | "Replied (true/false)"
  | "Contact Info Revealed (true/false)";

export function getFilterMeta(name: ContactFilter) {
  return CONTACT_FILTERS.find((f) => f.name === name)!;
}

export function AddFilterButton({
  onAdd,
}: {
  onAdd: (filter: ContactFilter) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground">
          <Filter className="h-3.5 w-3.5" />
          Add Filter
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-[400px] overflow-y-auto w-64">
        {CONTACT_FILTERS.map((f) => (
          <DropdownMenuItem
            key={f.name}
            onClick={() => onAdd(f.name)}
            className="text-sm cursor-pointer"
          >
            {f.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
