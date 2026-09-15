/**
 * useClinicianSearch — client hook for the search-clinicians engine.
 *
 * Fork doctrine: this hook belongs to the clinician engine alone. It shares
 * nothing with useSearchHistory / SearchPage's search-people flow.
 *
 * The criteria contract is the backbone: the response's `criteria` array is
 * rendered as chips (required / ranked / not filtered), `widen_options` are
 * criterion transformations that re-send `cached_parsed` so the positional
 * criterion ids stay stable, and `relaxed` labels every widening applied.
 */
import { useCallback, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ClinicianCriterion {
  id: string;
  kind: string;
  label: string;
  value: unknown;
  enforcement: "hard" | "soft" | "dropped";
  source: "user" | "inferred";
  note?: string;
}

export interface WidenOption {
  action: "city_to_state" | "drop";
  label: string;
  targetId: string;
}

export interface ClinicianResult {
  id: string | null;
  full_name: string;
  headline: string | null;
  summary: string | null;
  profile_picture_url: string | null;
  job_title: string | null;
  job_company_name: string | null;
  job_company_logo_url: string | null;
  job_company_domain: string | null;
  job_start_date: string | null;
  employer_class: "provider" | "commercial" | "unknown";
  location_locality: string | null;
  location_region: string | null;
  linkedin_url: string | null;
  education: Array<{
    school_name: string | null;
    degrees: string[];
    majors: string[];
    start_date: string | null;
    end_date: string | null;
  }>;
  experience_history: Array<{
    company_name: string | null;
    title: string | null;
    start_date: string | null;
    end_date: string | null;
    summary: string | null;
    is_primary: boolean;
  }>;
  match_scope: "primary" | "secondary";
  stage_fit?: "in_window" | "unknown" | "out_of_window";
  semantic_recall: boolean;
  past_role_match: boolean;
  audit_verdict: "strong" | "weak" | "reject" | null;
  audit_reason: string | null;
  audit_evidence: string | null;
  audit_score: number | null;
}

export interface ClinicianSearchResponse {
  results: ClinicianResult[];
  total: number;
  page: number;
  size: number;
  audit: Record<string, unknown> | null;
  semantic: { ran: boolean; added: number } | null;
  company_graph: { added: number } | null;
  fallback: "past_role_holders" | null;
  fallback_note: string | null;
  rejected_filtered: number;
  hasMore: boolean;
  engine_version: string;
  run_id: string;
  parsed: Record<string, unknown>;
  criteria: ClinicianCriterion[];
  relaxed: string[];
  exact: boolean;
  widen_options: WidenOption[];
  credits: number;
  credits_session: number;
  credit_ceiling: number;
  cache_hit: boolean;
  error?: string;
  error_code?: string;
  error_message?: string;
  next_action?: string;
  busy?: boolean;
  retry_after_ms?: number;
}

export interface SearchState {
  phase: "idle" | "searching" | "done" | "error";
  query: string;
  response: ClinicianSearchResponse | null;
  errorMessage: string | null;
  nextAction: string | null;
}

export interface WidenRequest {
  removeIds?: string[];
  cityToState?: boolean;
}

export function useClinicianSearch() {
  const [state, setState] = useState<SearchState>({
    phase: "idle",
    query: "",
    response: null,
    errorMessage: null,
    nextAction: null,
  });
  // The parse the engine echoed back — re-sent on widen/pagination so the
  // model is never re-run and criterion ids stay positionally stable.
  const cachedParsedRef = useRef<Record<string, unknown> | null>(null);
  const inFlightRef = useRef<AbortController | null>(null);

  const run = useCallback(async (
    query: string,
    opts: { page?: number; widen?: WidenRequest; freshParse?: boolean } = {},
  ) => {
    const trimmed = query.trim();
    if (!trimmed) return;
    inFlightRef.current?.abort();
    const ctrl = new AbortController();
    inFlightRef.current = ctrl;

    if (opts.freshParse) cachedParsedRef.current = null;
    setState((s) => ({ ...s, phase: "searching", query: trimmed, errorMessage: null, nextAction: null }));

    try {
      const body: Record<string, unknown> = {
        query: trimmed,
        page: opts.page ?? 0,
        size: 15,
      };
      if (cachedParsedRef.current) body.cached_parsed = cachedParsedRef.current;
      if (opts.widen?.removeIds?.length) body.removeIds = opts.widen.removeIds;
      if (opts.widen?.cityToState) body.cityToState = true;

      const { data, error } = await supabase.functions.invoke("search-clinicians", { body });
      if (ctrl.signal.aborted) return;
      if (error) throw new Error(error.message || "Search failed");
      const resp = data as ClinicianSearchResponse;
      if (resp?.error && !Array.isArray(resp?.results)) {
        throw new Error(resp.error);
      }
      if (resp?.parsed && typeof resp.parsed === "object") {
        cachedParsedRef.current = resp.parsed;
      }
      setState({
        phase: "done",
        query: trimmed,
        response: resp,
        errorMessage: resp?.error_message && resp.total === 0 && resp.error_code !== "no_results"
          ? resp.error_message
          : null,
        nextAction: resp?.next_action ?? null,
      });
    } catch (err) {
      if (ctrl.signal.aborted) return;
      setState((s) => ({
        ...s,
        phase: "error",
        errorMessage: err instanceof Error ? err.message : "Search failed",
        nextAction: null,
      }));
    }
  }, []);

  const search = useCallback((query: string) => run(query, { freshParse: true }), [run]);
  const goToPage = useCallback((page: number) => run(state.query, { page }), [run, state.query]);
  const widen = useCallback((widenReq: WidenRequest) => run(state.query, { widen: widenReq }), [run, state.query]);
  const reset = useCallback(() => {
    inFlightRef.current?.abort();
    cachedParsedRef.current = null;
    setState({ phase: "idle", query: "", response: null, errorMessage: null, nextAction: null });
  }, []);

  return { state, search, goToPage, widen, reset };
}
