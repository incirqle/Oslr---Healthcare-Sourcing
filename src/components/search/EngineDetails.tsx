import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CriterionVerdict } from "./SearchResults";

/** Verdict words. Never "Maybe" for an engine verdict (that word is the recruiter's own fit call). */
export const VERDICT_LABEL: Record<CriterionVerdict, string> = {
  met: "Yes",
  partial: "Partly",
  unknown: "Not shown",
  not_met: "No",
};

/**
 * One mark per verdict, in brand colors only (navy, seafoam, gray).
 * Shape carries the meaning as much as color: filled, half, empty, crossed.
 */
export function VerdictMark({ status, className }: { status: CriterionVerdict; className?: string }) {
  const base = "inline-flex shrink-0 items-center justify-center rounded-full";
  if (status === "met") {
    return (
      <span className={cn(base, "h-5 w-5 bg-[#0A1F44] text-white dark:bg-[#7AC5B0] dark:text-[#0A1F44]", className)} aria-hidden="true">
        <Check className="h-3 w-3" strokeWidth={3} />
      </span>
    );
  }
  if (status === "partial") {
    return (
      <span className={cn(base, "h-5 w-5 border-2 border-[#0A1F44] bg-[linear-gradient(90deg,#0A1F44_50%,transparent_50%)] dark:border-[#7AC5B0] dark:bg-[linear-gradient(90deg,#7AC5B0_50%,transparent_50%)]", className)} aria-hidden="true" />
    );
  }
  if (status === "not_met") {
    return (
      <span className={cn(base, "h-5 w-5 border border-border text-muted-foreground", className)} aria-hidden="true">
        <X className="h-3 w-3" strokeWidth={2.5} />
      </span>
    );
  }
  return <span className={cn(base, "h-5 w-5 border border-dashed border-muted-foreground/50", className)} aria-hidden="true" />;
}

export function VerdictPill({ status, title }: { status: CriterionVerdict; title?: string }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 text-[13px] font-medium text-foreground">
      <VerdictMark status={status} className="h-4 w-4" />
      {VERDICT_LABEL[status]}
      {title && <span className="font-normal text-foreground/70">· {title}</span>}
    </span>
  );
}
