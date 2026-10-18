import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Candidate } from "./SearchResults";
import { toTitleCase } from "./candidate-ui";

/** Set-aside reasons and their labels (spec 8), in display order. */
export const SET_ASIDE_LABEL: Record<string, string> = {
  grader: "Didn't fit on review",
  must_have: "Failed a must-have",
  employment_model: "Wrong employer type",
  military_reserve: "Guard or Reserve, civilian primary job",
  thin_profile: "Too little on the profile",
  duplicates: "Likely duplicate",
  role_class_noise: "Not a clinician in this role",
};
const ORDER = Object.keys(SET_ASIDE_LABEL);

function reasonLine(c: Candidate): string {
  if (c.set_aside_note) return c.set_aside_note;
  if (c.set_aside_reason === "employment_model" && c.employment_model_evidence) return c.employment_model_evidence;
  if (c.set_aside_reason === "military_reserve" && c.military_evidence) return c.military_evidence;
  return c.audit_reason ?? "";
}

export function SetAsideTab({
  candidates,
  onRestore,
  onOpenCandidate,
}: {
  candidates: Candidate[];
  onRestore: (c: Candidate) => void;
  onOpenCandidate?: (c: Candidate) => void;
}) {
  const groups = useMemo(() => {
    const m = new Map<string, Candidate[]>();
    for (const c of candidates) {
      const key = c.set_aside_reason && SET_ASIDE_LABEL[c.set_aside_reason] ? c.set_aside_reason : c.audit_verdict === "reject" ? "grader" : "other";
      m.set(key, [...(m.get(key) ?? []), c]);
    }
    return [...m.entries()].sort((a, b) => (ORDER.indexOf(a[0]) + 1 || 99) - (ORDER.indexOf(b[0]) + 1 || 99));
  }, [candidates]);
  const [closed, setClosed] = useState<Record<string, boolean>>({});

  if (candidates.length === 0) {
    return <p className="rounded-xl border border-border/50 bg-card/40 p-6 text-center text-sm text-muted-foreground">Nobody was set aside for this search.</p>;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Kept out of your results, with the reason. Restore anyone you want to look at.</p>
      {groups.map(([key, rows]) => (
        <section key={key} className="overflow-hidden rounded-xl border border-border/60 bg-card">
          <button
            type="button"
            onClick={() => setClosed((c) => ({ ...c, [key]: !c[key] }))}
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
            aria-expanded={!closed[key]}
          >
            <span className="text-sm font-semibold text-foreground">
              {SET_ASIDE_LABEL[key] ?? "Other"} <span className="font-normal tabular-nums text-muted-foreground">{rows.length}</span>
            </span>
            <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", closed[key] && "-rotate-90")} />
          </button>
          {!closed[key] && (
            <ul className="divide-y divide-border/60 border-t border-border/60">
              {rows.map((c) => (
                <li key={c.id} className="flex items-start justify-between gap-3 px-4 py-2.5">
                  <button type="button" onClick={() => onOpenCandidate?.(c)} className="min-w-0 text-left">
                    <p className="truncate text-sm font-medium text-foreground">{c.full_name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[c.title && toTitleCase(c.title), c.current_employer && toTitleCase(c.current_employer)].filter(Boolean).join(" · ")}
                    </p>
                    {reasonLine(c) && <p className="mt-0.5 text-xs text-muted-foreground/90">{reasonLine(c)}</p>}
                  </button>
                  <button
                    type="button"
                    onClick={() => onRestore(c)}
                    className="shrink-0 rounded-md border border-border px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted"
                  >
                    Restore
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
