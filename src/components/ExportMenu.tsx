import { useState } from "react";
import { Download, FileText, FileSpreadsheet, Linkedin, Loader2, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { downloadCandidatesCsv, downloadLinkedInRecruiterCsv } from "@/lib/export-csv";
import { downloadCandidatePdfs } from "@/lib/export-pdf";
import type { AnyCandidate } from "@/lib/candidate-export-adapter";
import { cn } from "@/lib/utils";

interface Props {
  /** Resolved when the window opens, preserving the exact selected rows. */
  getCandidates: () => AnyCandidate[];
  /** Disable PDF when the source rows have no usable profile payload. */
  pdfDisabled?: boolean;
  variant?: "outline" | "ghost" | "default";
  size?: "sm" | "default";
  label?: string;
  className?: string;
  align?: "start" | "end";
  /** Explains the current scope, for example "3 selected" or "Individual profile". */
  scopeLabel?: string;
}

type ExportKind = "csv" | "linkedin" | "pdf";

export function ExportMenu({
  getCandidates,
  pdfDisabled,
  variant = "outline",
  size = "sm",
  label = "Export",
  className,
  scopeLabel,
}: Props) {
  const [open, setOpen] = useState(false);
  const [candidates, setCandidates] = useState<AnyCandidate[]>([]);
  const [includeContactInfo, setIncludeContactInfo] = useState(true);
  const [busy, setBusy] = useState<ExportKind | null>(null);

  const openExport = () => {
    const list = getCandidates();
    if (list.length === 0) {
      toast.info("Nothing to export. Change your filters or select a profile.");
      return;
    }
    setCandidates(list);
    setIncludeContactInfo(true);
    setOpen(true);
  };

  const finish = () => {
    setOpen(false);
    setBusy(null);
  };

  const handleCsv = () => {
    setBusy("csv");
    try {
      downloadCandidatesCsv(candidates, undefined, { includeContactInfo });
      toast.success(`Exported ${candidates.length} profile${candidates.length === 1 ? "" : "s"} to CSV`);
      finish();
    } catch {
      setBusy(null);
      toast.error("The CSV could not be created. Please try again.");
    }
  };

  const handleLinkedIn = () => {
    setBusy("linkedin");
    try {
      downloadLinkedInRecruiterCsv(candidates, { includeContactInfo });
      toast.success(`Prepared ${candidates.length} profile${candidates.length === 1 ? "" : "s"} for LinkedIn Recruiter`);
      finish();
    } catch {
      setBusy(null);
      toast.error("The LinkedIn CSV could not be created. Please try again.");
    }
  };

  const handlePdf = async () => {
    setBusy("pdf");
    try {
      await downloadCandidatePdfs(candidates, { includeContactInfo });
      toast.success(candidates.length === 1 ? "Clinical profile PDF downloaded" : `Bundled ${candidates.length} clinical profiles into a ZIP`);
      finish();
    } catch (error) {
      console.error(error);
      setBusy(null);
      toast.error("The PDF could not be created. Please try again.");
    }
  };

  return (
    <>
      <Button type="button" variant={variant} size={size} className={className} onClick={openExport}>
        <Download className="mr-1.5 h-3.5 w-3.5" />
        {label}
      </Button>

      <Dialog open={open} onOpenChange={(next) => !busy && setOpen(next)}>
        <DialogContent className="max-h-[92dvh] w-[calc(100%-1.5rem)] max-w-[560px] overflow-y-auto rounded-3xl border-ui-border-medium bg-card p-0 shadow-2xl">
          <div className="border-b border-ui-border-light bg-ui-surface-subtle px-6 py-6 sm:px-7">
            <DialogHeader className="space-y-2 pr-8">
              <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/15 text-mint-ink">
                <Download className="h-5 w-5" />
              </div>
              <DialogTitle className="font-display text-[22px] tracking-[-0.02em] text-foreground">
                Export {candidates.length === 1 ? "profile" : "profiles"}
              </DialogTitle>
              <DialogDescription className="text-[13px] leading-5 text-ui-text-secondary">
                {scopeLabel ?? `${candidates.length} profile${candidates.length === 1 ? "" : "s"}`}. Choose exactly how you want to take this information with you.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="space-y-5 px-6 py-6 sm:px-7">
            <div className="flex items-center justify-between gap-5 rounded-2xl border border-ui-border-light bg-ui-surface-subtle p-4">
              <div className="min-w-0">
                <label htmlFor="export-contact-info" className="block cursor-pointer text-[14px] font-medium text-foreground">
                  Include saved contact information
                </label>
                <p className="mt-1 text-[12px] leading-5 text-ui-text-tertiary">
                  Work email, personal email and phone numbers already on each profile.
                </p>
              </div>
              <Switch
                id="export-contact-info"
                checked={includeContactInfo}
                onCheckedChange={setIncludeContactInfo}
                disabled={!!busy}
                aria-label="Include saved contact information"
              />
            </div>

            <div className="space-y-2.5" aria-label="Export formats">
              <ExportOption
                icon={<FileSpreadsheet className="h-5 w-5" />}
                title="CSV spreadsheet"
                description="Clinical role, organization, location, experience and education."
                busy={busy === "csv"}
                disabled={!!busy}
                onClick={handleCsv}
              />
              <ExportOption
                icon={<Linkedin className="h-5 w-5" />}
                title="LinkedIn Recruiter CSV"
                description="A simplified file with profile URLs and current role details."
                busy={busy === "linkedin"}
                disabled={!!busy}
                onClick={handleLinkedIn}
              />
              <ExportOption
                icon={<FileText className="h-5 w-5" />}
                title="Clinical profile PDF"
                description={candidates.length === 1
                  ? "A polished brief with training, experience and available research."
                  : "One polished PDF per person, downloaded together as a ZIP."}
                busy={busy === "pdf"}
                disabled={!!busy || pdfDisabled}
                unavailable={pdfDisabled ? "PDF is not available for these rows" : undefined}
                onClick={() => void handlePdf()}
              />
            </div>

            <div className="flex items-start gap-2.5 text-[11px] leading-5 text-ui-text-tertiary">
              <LockKeyhole className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <p>Exports use only information already saved on each profile. They never run a new contact lookup or use credits.</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ExportOption({
  icon,
  title,
  description,
  busy,
  disabled,
  unavailable,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  busy: boolean;
  disabled: boolean;
  unavailable?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "group flex w-full items-center gap-4 rounded-2xl border border-ui-border-light bg-card p-4 text-left transition-all duration-150",
        "hover:-translate-y-px hover:border-primary/50 hover:bg-primary/[0.04] active:translate-y-0 active:scale-[0.99]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:border-ui-border-light disabled:hover:bg-card",
      )}
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-ui-text-secondary transition-colors group-hover:bg-primary/15 group-hover:text-mint-ink">
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-semibold text-foreground">{title}</span>
        <span className="mt-0.5 block text-[12px] leading-5 text-ui-text-tertiary">{unavailable ?? description}</span>
      </span>
      {!busy && !unavailable && <Download className="h-4 w-4 shrink-0 text-ui-text-muted transition-colors group-hover:text-mint-ink" />}
    </button>
  );
}
