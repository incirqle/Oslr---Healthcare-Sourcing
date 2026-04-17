import { DollarSign, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatSalaryBucket } from "@/constants/clinicalSalaryPresets";

interface CandidateSalaryBadgeProps {
  inferredSalary?: string | null;
  yearsExperience?: number | null;
  className?: string;
  size?: "sm" | "md";
}

/**
 * Displays inferred salary + years of experience as muted "inferred" badges.
 * Both fields are PDL model estimates — the "inferred" label is intentional
 * to keep recruiters honest about data confidence. Omits whichever side is null.
 */
export function CandidateSalaryBadge({
  inferredSalary,
  yearsExperience,
  className,
  size = "sm",
}: CandidateSalaryBadgeProps) {
  const salaryLabel = formatSalaryBucket(inferredSalary);
  const showYears = typeof yearsExperience === "number" && yearsExperience > 0;
  if (!salaryLabel && !showYears) return null;

  const text = size === "md" ? "text-[13px]" : "text-[12px]";
  const padding = size === "md" ? "px-2.5 py-1" : "px-2 py-0.5";

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {salaryLabel && (
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-md bg-salary text-salary-foreground font-medium leading-none",
            text,
            padding,
          )}
          title="Inferred from PDL — model estimate"
        >
          <DollarSign className="h-3 w-3 opacity-70" />
          {salaryLabel}
          <span className="ml-1 text-[10px] uppercase tracking-wide opacity-60">inferred</span>
        </span>
      )}
      {showYears && (
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-md bg-ui-surface-subtle text-ui-text-tertiary leading-none",
            text,
            padding,
          )}
          title="Inferred years of experience — model estimate"
        >
          <Clock className="h-3 w-3 opacity-70" />
          {yearsExperience} yrs
          <span className="ml-1 text-[10px] uppercase tracking-wide opacity-60">inferred</span>
        </span>
      )}
    </div>
  );
}
