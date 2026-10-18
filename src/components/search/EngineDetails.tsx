import { useState } from "react";
import { Check, CircleDashed, CircleSlash, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Candidate, CandidateCriterionResult, CriterionVerdict } from "./SearchResults";

/** Verdict words (spec 2, 13). Never "Maybe" for an engine verdict. */
export const VERDICT_LABEL: Record<CriterionVerdict, string> = {
  met: "Yes",
  partial: "Partly",
  unknown: "Not shown",
  not_met: "No",
};

const VERDICT_STYLE: Record<CriterionVerdict, string> = {
  met: "border-success/30 bg-success/10 text-success",
  partial: "border-warning/30 bg-warning/10 text-warning",
  unknown: "border-border bg-muted/40 text-muted-foreground",
  not_met: "border-destructive/30 bg-destructive/10 text-destructive",
};

const VERDICT_ICON: Record<CriterionVerdict, typeof Check> = {
  met: Check,
  partial: Minus,
  unknown: CircleDashed,
  not_met: CircleSlash,
};

const CREDIT: Record<CriterionVerdict, number> = { met: 1, partial: 0.5, unknown: 0.25, not_met: 0 };

export function VerdictPill({ status, title }: { status: CriterionVerdict; title?: string }) {
  const Icon = VERDICT_ICON[status];
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-px text-[10.5px] font-medium", VERDICT_STYLE[status])}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      {VERDICT_LABEL[status]}
      {title && <span className="font-normal text-foreground/80">· {title}</span>}
    </span>
  );
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function monthLabel(iso: unknown): string | null {
  const m = typeof iso === "string" ? iso.match(/^(\d{4})-(\d{2})/) : null;
  return m ? `${MONTHS[Number(m[2]) - 1]} ${m[1]}` : null;
}

/** Tags the engine already computed (spec 9.3). */
export function engineTags(c: Candidate): { label: string; title?: string }[] {
  const tags: { label: string; title?: string }[] = [];
  if (c.match_scope === "primary") tags.push({ label: "Primary role" });
  if (c.match_scope === "secondary") tags.push({ label: "Matched on a side role" });
  const started = monthLabel(c.raw?.job_start_date);
  if (c.stage_fit === "in_window") tags.push({ label: started ? `Started ${started}, fits the training year` : "Fits the training year" });
  if (c.stage_fit === "out_of_window") tags.push({ label: started ? `Started ${started}, outside the training year` : "Outside the training year" });
  if (c.employment_model === "private_practice") tags.push({ label: "Private practice", title: c.employment_model_evidence ?? undefined });
  if (c.employment_model === "hospital_employed") tags.push({ label: "Hospital employed", title: c.employment_model_evidence ?? undefined });
  return tags;
}

export function EngineDetails({ candidate }: { candidate: Candidate }) {
  const [expanded, setExpanded] = useState(false);
  const preferred: CandidateCriterionResult[] = (candidate.criteria_results ?? []).filter((r) => r.group !== "required");
  const tags = engineTags(candidate);
  const lines = expanded ? preferred : preferred.slice(0, 4);
  const hasMatch = typeof candidate.match_rate === "number" && preferred.length > 0;
  const evidence = candidate.audit_evidence || candidate.evidence_snippet;
  if (!hasMatch && preferred.length === 0 && tags.length === 0 && !candidate.audit_reason && !evidence && !candidate.restored) return null;

  return (
    <div className="space-y-1.5 border-t border-ui-border-light pt-2">
      {hasMatch && (
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-semibold tabular-nums text-foreground">{candidate.match_rate}% match</span>
          <span className="flex h-1.5 w-28 gap-0.5" aria-hidden="true">
            {preferred.map((r) => (
              <span key={r.criterion_id} className="relative flex-1 overflow-hidden rounded-full bg-muted">
                <span className="absolute inset-y-0 left-0 bg-primary" style={{ width: `${CREDIT[r.status] * 100}%` }} />
              </span>
            ))}
          </span>
        </div>
      )}

      {lines.length > 0 && (
        <ul className="space-y-1">
          {lines.map((r) => (
            <li key={r.criterion_id} className="flex min-w-0 items-start gap-2 text-[12px]">
              <VerdictPill status={r.status} title={r.title} />
              {r.evidence && <span className="truncate text-muted-foreground" title={r.evidence}>"{r.evidence}"</span>}
            </li>
          ))}
        </ul>
      )}
      {preferred.length > 4 && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
          className="text-[11.5px] font-medium text-primary hover:underline"
        >
          {expanded ? "Show less" : `+${preferred.length - 4} more`}
        </button>
      )}

      {(tags.length > 0 || candidate.restored) && (
        <div className="flex flex-wrap gap-1">
          {candidate.restored && (
            <span className="rounded-full border border-primary/40 bg-primary/10 px-1.5 py-px text-[10.5px] font-medium text-foreground">Restored by you</span>
          )}
          {tags.map((t) => (
            <span key={t.label} title={t.title} className="rounded-full border border-ui-border-light px-1.5 py-px text-[10.5px] font-medium text-muted-foreground">
              {t.label}
            </span>
          ))}
        </div>
      )}

      {evidence && preferred.length === 0 && (
        <p className="truncate text-[12px] text-muted-foreground" title={evidence}>"{evidence}"</p>
      )}
      {candidate.audit_reason && <p className="text-[12px] text-muted-foreground">{candidate.audit_reason}</p>}
    </div>
  );
}
