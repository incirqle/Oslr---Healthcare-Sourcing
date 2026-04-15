import { formatBucketLabel } from "@/constants/clinicalSalaryPresets";

interface CandidateSalaryBadgeProps {
  inferredSalary?: string | null;
  yearsExperience?: number | null;
}

export function CandidateSalaryBadge({ inferredSalary, yearsExperience }: CandidateSalaryBadgeProps) {
  if (!inferredSalary && !yearsExperience) return null;

  return (
    <div className="flex flex-wrap items-center gap-3">
      {inferredSalary && (
        <span className="inline-flex flex-col items-start">
          <span className="rounded-[4px] bg-salary px-2.5 py-1 text-[13px] font-medium leading-none text-salary-foreground">
            💰 {formatBucketLabel(inferredSalary)}
          </span>
          <span className="mt-0.5 text-[10px] text-ui-text-muted">inferred</span>
        </span>
      )}
      {(yearsExperience ?? 0) > 0 && (
        <span className="inline-flex flex-col items-start">
          <span className="text-[13px] text-ui-text-secondary">
            ⏱ {yearsExperience} yrs experience
          </span>
          <span className="mt-0.5 text-[10px] text-ui-text-muted">inferred</span>
        </span>
      )}
    </div>
  );
}
