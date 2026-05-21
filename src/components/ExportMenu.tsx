import { useState } from "react";
import { ChevronDown, Download, FileText, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { downloadCandidatesCsv } from "@/lib/export-csv";
import { downloadCandidatePdfs } from "@/lib/export-pdf";
import type { AnyCandidate } from "@/lib/candidate-export-adapter";

interface Props {
  /** Resolver — invoked when the user picks an option so the host page can decide
   * what's selected vs filtered at click-time. */
  getCandidates: () => AnyCandidate[];
  /** Disable PDF when the source rows have no PDL `raw` payload (e.g. mock data). */
  pdfDisabled?: boolean;
  variant?: "outline" | "ghost" | "default";
  size?: "sm" | "default";
  label?: string;
  className?: string;
  align?: "start" | "end";
}

export function ExportMenu({
  getCandidates,
  pdfDisabled,
  variant = "outline",
  size = "sm",
  label = "Export",
  className,
  align = "end",
}: Props) {
  const [busy, setBusy] = useState(false);

  const handleCsv = () => {
    const list = getCandidates();
    if (list.length === 0) {
      toast.info("Nothing to export.");
      return;
    }
    downloadCandidatesCsv(list);
    toast.success(`Exported ${list.length} row${list.length === 1 ? "" : "s"} to CSV`);
  };

  const handlePdf = async () => {
    const list = getCandidates();
    if (list.length === 0) {
      toast.info("Nothing to export.");
      return;
    }
    setBusy(true);
    try {
      await downloadCandidatePdfs(list);
      toast.success(
        list.length === 1
          ? "Profile PDF downloaded"
          : `Bundled ${list.length} profiles into a ZIP`,
      );
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate PDF");
    } finally {
      setBusy(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size} className={className} disabled={busy}>
          <Download className="h-3.5 w-3.5 mr-1.5" />
          {busy ? "Exporting…" : label}
          <ChevronDown className="h-3 w-3 ml-1 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align}>
        <DropdownMenuItem onClick={handleCsv}>
          <FileSpreadsheet className="h-3.5 w-3.5 mr-2" />
          Export as CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handlePdf} disabled={pdfDisabled}>
          <FileText className="h-3.5 w-3.5 mr-2" />
          {pdfDisabled ? "PDF dossier (unavailable)" : "Export as PDF dossier"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
