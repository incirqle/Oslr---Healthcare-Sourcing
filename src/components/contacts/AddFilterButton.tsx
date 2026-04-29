import { Filter } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

export const CONTACT_FILTERS = [
  "Status",
  "Owner",
  "Project",
  "Tags",
  "Location",
  "Current Company",
  "Current + Past Company",
  "Job Title",
  "Current + Past Job Title",
  "School / University",
  "Major",
  "Skills",
  "Date Contact Created",
  "Date Last Enrolled in Campaign",
  "Last Enrolled in Campaign by",
  "Date Last Contacted",
  "Date Last Replied",
  "Contacted (true/false)",
  "Replied (true/false)",
  "Contact Info Revealed (true/false)",
] as const;

export type ContactFilter = (typeof CONTACT_FILTERS)[number];

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
            key={f}
            onClick={() => onAdd(f)}
            className="text-sm cursor-pointer"
          >
            {f}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
