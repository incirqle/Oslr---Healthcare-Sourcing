/**
 * ClinicianSearch — the search-clinicians engine's own page (fork doctrine:
 * only generic ui primitives are shared; nothing search-shaped is imported
 * from the pdl-search surfaces).
 *
 * The criteria contract is rendered honestly:
 *  - "required" chips  = enforcement hard (in the filter tree)
 *  - "ranked" chips    = enforcement soft (scoring only)
 *  - "not filtered"    = enforcement dropped (surfaced, never enforced)
 * Widen actions are criterion transformations (drop-by-id, city→state) that
 * re-send the cached parse; every applied relaxation is labelled.
 */
import { useCallback, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertTriangle,
  Building2,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  Loader2,
  Quote,
  Search,
  Sparkles,
  Stethoscope,
} from "lucide-react";
import {
  useClinicianSearch,
  type ClinicianCriterion,
  type ClinicianResult,
} from "@/hooks/useClinicianSearch";
import { AppLayout } from "@/components/AppLayout";

const EXAMPLES = [
  "PGY-3 podiatric residents in Texas",
  "Nurses with a cardiovascular background and 5 years of experience",
  "Orthopedic physicians at the VA",
  "Nurses who used to work in the OR, now on a med-surg floor in Dallas",
];

function CriterionChip({ c }: { c: ClinicianCriterion }) {
  const styles =
    c.enforcement === "hard"
      ? "border-primary/40 bg-primary/10 text-primary"
      : c.enforcement === "soft"
      ? "border-amber-400/50 bg-amber-400/10 text-amber-700 dark:text-amber-400"
      : "border-muted-foreground/30 bg-muted text-muted-foreground line-through decoration-1";
  const tag = c.enforcement === "hard" ? "required" : c.enforcement === "soft" ? "ranked" : "not filtered";
  const chip = (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${styles}`}>
      {c.label}
      <span className="opacity-60">· {tag}</span>
    </span>
  );
  if (!c.note) return chip;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{chip}</TooltipTrigger>
      <TooltipContent className="max-w-xs text-xs">{c.note}</TooltipContent>
    </Tooltip>
  );
}

function VerdictBadge({ r }: { r: ClinicianResult }) {
  if (!r.audit_verdict) return null;
  const cls = r.audit_verdict === "strong"
    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
    : "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="outline" className={cls}>
          {r.audit_verdict}
          {typeof r.audit_score === "number" ? ` · ${r.audit_score}` : ""}
        </Badge>
      </TooltipTrigger>
      {r.audit_reason && (
        <TooltipContent className="max-w-xs text-xs">{r.audit_reason}</TooltipContent>
      )}
    </Tooltip>
  );
}

function ResultRow({ r }: { r: ClinicianResult }) {
  const location = [r.location_locality, r.location_region].filter(Boolean).join(", ");
  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        {r.profile_picture_url ? (
          <img src={r.profile_picture_url} alt="" className="h-10 w-10 rounded-full object-cover" />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
            <Stethoscope className="h-5 w-5 text-muted-foreground" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{r.full_name}</span>
            {r.linkedin_url && (
              <a href={r.linkedin_url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground">
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
            <VerdictBadge r={r} />
            {r.past_role_match && (
              <Badge variant="outline" className="border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-400">
                past-role match
              </Badge>
            )}
            {r.match_scope === "secondary" && (
              <Badge variant="outline" className="text-muted-foreground">
                matched on a secondary role
              </Badge>
            )}
            {r.stage_fit === "out_of_window" && (
              <Badge variant="outline" className="border-red-400/40 text-red-600 dark:text-red-400">
                <Clock className="mr-1 h-3 w-3" /> start date off the asked year
              </Badge>
            )}
            {r.semantic_recall && (
              <Badge variant="outline" className="text-muted-foreground">
                <Sparkles className="mr-1 h-3 w-3" /> semantic match
              </Badge>
            )}
          </div>
          <div className="mt-0.5 text-sm text-muted-foreground">
            {[r.job_title, r.job_company_name].filter(Boolean).join(" · ")}
            {location ? ` · ${location}` : ""}
            {r.employer_class !== "unknown" && (
              <span className="ml-2 inline-flex items-center gap-1 text-xs">
                <Building2 className="h-3 w-3" />
                {r.employer_class === "provider" ? "care delivery" : "commercial"}
              </span>
            )}
          </div>
          {r.headline && <div className="mt-1 text-sm">{r.headline}</div>}
          {r.audit_evidence && (
            <div className="mt-2 flex items-start gap-1.5 rounded-md border border-amber-300/40 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
              <Quote className="mt-0.5 h-3 w-3 shrink-0" />
              <span>“{r.audit_evidence}”</span>
            </div>
          )}
          {r.experience_history.length > 0 && (
            <details className="mt-2 text-sm">
              <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                {r.experience_history.length} role{r.experience_history.length === 1 ? "" : "s"} · education & history
              </summary>
              <div className="mt-2 space-y-2 border-l pl-3">
                {r.experience_history.slice(0, 8).map((e, i) => (
                  <div key={i}>
                    <div className="text-sm">
                      <span className="font-medium">{e.title ?? "—"}</span>
                      {e.company_name ? ` · ${e.company_name}` : ""}
                      {e.is_primary && <span className="ml-1 text-xs text-primary">current · primary</span>}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {[e.start_date?.slice(0, 7), e.end_date ? e.end_date.slice(0, 7) : e.is_primary ? "present" : null]
                        .filter(Boolean).join(" → ")}
                    </div>
                    {e.summary && <div className="mt-0.5 line-clamp-3 text-xs text-muted-foreground">{e.summary}</div>}
                  </div>
                ))}
                {r.education.length > 0 && (
                  <div className="pt-1 text-xs text-muted-foreground">
                    {r.education.map((ed, i) => (
                      <div key={i}>
                        {[ed.degrees.join("/"), ed.majors.join("/"), ed.school_name].filter(Boolean).join(" · ")}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </details>
          )}
        </div>
      </div>
    </Card>
  );
}

export default function ClinicianSearch() {
  const { state, search, goToPage, widen } = useClinicianSearch();
  const [input, setInput] = useState("");
  const resp = state.response;

  const submit = useCallback(() => {
    if (input.trim()) search(input);
  }, [input, search]);

  return (
    <AppLayout>
    <div className="mx-auto max-w-4xl space-y-4 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold">Clinician Search</h1>
        <p className="text-sm text-muted-foreground">
          Crustdata-powered clinical search engine — criteria are shown exactly as enforced.
        </p>
      </div>

      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Describe who you're looking for…"
        />
        <Button onClick={submit} disabled={state.phase === "searching" || !input.trim()}>
          {state.phase === "searching" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          <span className="ml-1.5 hidden sm:inline">Search</span>
        </Button>
      </div>

      {state.phase === "idle" && (
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((q) => (
            <button
              key={q}
              className="rounded-full border px-3 py-1 text-xs text-muted-foreground hover:bg-muted"
              onClick={() => { setInput(q); search(q); }}
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {state.phase === "error" && (
        <Card className="border-destructive/40 p-4 text-sm">
          <div className="flex items-center gap-2 font-medium text-destructive">
            <AlertTriangle className="h-4 w-4" /> {state.errorMessage ?? "Search failed"}
          </div>
          {state.nextAction && <div className="mt-1 text-muted-foreground">{state.nextAction}</div>}
        </Card>
      )}

      {resp && state.phase !== "error" && (
        <>
          {/* The contract echoed back */}
          {resp.criteria?.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              {resp.criteria.map((c) => <CriterionChip key={c.id} c={c} />)}
            </div>
          )}

          {/* Every relaxation, labelled */}
          {resp.relaxed?.length > 0 && (
            <Card className="border-amber-400/40 bg-amber-50/60 p-3 text-sm dark:bg-amber-950/20">
              <span className="font-medium">Widened:</span> {resp.relaxed.join(" · ")}
            </Card>
          )}

          {/* Honest past-role fallback */}
          {resp.fallback === "past_role_holders" && resp.fallback_note && (
            <Card className="border-violet-400/40 bg-violet-50/60 p-3 text-sm dark:bg-violet-950/20">
              {resp.fallback_note}
            </Card>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
            <div>
              {state.phase === "searching"
                ? "Searching…"
                : `${resp.total.toLocaleString()} match${resp.total === 1 ? "" : "es"}`}
              {resp.rejected_filtered > 0 && ` · ${resp.rejected_filtered} rejected by the grader (removed)`}
              {resp.audit && typeof resp.audit === "object" && "strong" in resp.audit && (
                <> · graded: {String((resp.audit as Record<string, unknown>).strong)} strong / {String((resp.audit as Record<string, unknown>).weak)} weak</>
              )}
            </div>
            <div>
              {resp.credits_session?.toFixed?.(2) ?? resp.credits_session} / {resp.credit_ceiling} session credits
              {resp.cache_hit ? " · cached" : ""}
            </div>
          </div>

          {/* Honest zero + guard messages */}
          {resp.results.length === 0 && (
            <Card className="p-6 text-center text-sm text-muted-foreground">
              <div className="font-medium text-foreground">
                {resp.error_message ?? "No one currently in this role matched every requirement."}
              </div>
              {resp.next_action && <div className="mt-1">{resp.next_action}</div>}
            </Card>
          )}

          <div className="space-y-3">
            {resp.results.map((r, i) => <ResultRow key={r.id ?? i} r={r} />)}
          </div>

          {/* Labelled widen actions — criterion transformations, never silent */}
          {resp.widen_options?.length > 0 && (
            <Card className="p-3">
              <div className="mb-2 text-xs font-medium text-muted-foreground">
                Thin results — widen the search:
              </div>
              <div className="flex flex-wrap gap-2">
                {resp.widen_options.map((o) => (
                  <Button
                    key={`${o.action}:${o.targetId}`}
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      o.action === "city_to_state"
                        ? widen({ cityToState: true })
                        : widen({ removeIds: [o.targetId] })}
                  >
                    {o.label}
                  </Button>
                ))}
              </div>
            </Card>
          )}

          {(resp.page > 0 || resp.hasMore) && (
            <div className="flex items-center justify-center gap-2">
              <Button size="sm" variant="outline" disabled={resp.page === 0 || state.phase === "searching"} onClick={() => goToPage(resp.page - 1)}>
                <ChevronLeft className="h-4 w-4" /> Prev
              </Button>
              <span className="text-sm text-muted-foreground">Page {resp.page + 1}</span>
              <Button size="sm" variant="outline" disabled={!resp.hasMore || state.phase === "searching"} onClick={() => goToPage(resp.page + 1)}>
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
    </AppLayout>
  );
}
