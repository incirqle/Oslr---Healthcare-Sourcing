import { ChevronDown, Download, FolderPlus, Mail, Tag, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { FitStatus } from "@/hooks/useCandidateFit";

interface Props {
  count: number;
  projectName?: string;
  onAddToProject: () => void;
  onAddToCampaign: () => void;
  onMarkFit: (status: FitStatus) => void;
  onExportCsv: () => void;
  onClear: () => void;
  isSaving?: boolean;
}

const FIT_OPTIONS: Array<{ value: FitStatus; label: string }> = [
  { value: "good", label: "Good fit" },
  { value: "maybe", label: "Maybe" },
  { value: "not", label: "Not a fit" },
];

/**
 * Sticky bulk-action bar shown when 1+ candidates are checked.
 * Slides in below the results header.
 */
export function BulkActionBar({
  count,
  projectName,
  onAddToProject,
  onAddToCampaign,
  onMarkFit,
  onExportCsv,
  onClear,
  isSaving,
}: Props) {
  return (
    <div className="sticky top-0 z-20 flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-primary/10">
      <span className="mr-2 text-sm font-semibold text-foreground">
        {count} selected
      </span>

      <Button
        size="sm"
        onClick={onAddToProject}
        disabled={isSaving}
        className="h-8 gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
      >
        <FolderPlus className="h-3.5 w-3.5" />
        {isSaving ? "Saving…" : `Add to ${projectName ? `"${projectName}"` : "project"}`}
      </Button>

      <Button
        size="sm"
        variant="outline"
        onClick={onAddToCampaign}
        className="h-8 gap-1.5"
      >
        <Mail className="h-3.5 w-3.5" />
        Add to campaign
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline" className="h-8 gap-1.5">
            <Tag className="h-3.5 w-3.5" />
            Mark as
            <ChevronDown className="h-3 w-3 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {FIT_OPTIONS.map((opt) => (
            <DropdownMenuItem key={opt.value} onClick={() => onMarkFit(opt.value)}>
              {opt.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Button size="sm" variant="outline" onClick={onExportCsv} className="h-8 gap-1.5">
        <Download className="h-3.5 w-3.5" />
        Export CSV
      </Button>

      <button
        type="button"
        onClick={onClear}
        className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <X className="h-3.5 w-3.5" />
        Clear
      </button>
    </div>
  );
}
