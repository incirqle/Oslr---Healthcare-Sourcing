// errors.ts — search-clinicians error message taxonomy .
//
// Pure module: maps every W2 failure condition to a stable
// { code, userMessage, nextAction } triple so the edge function, logs, and
// client toasts all speak the same language. No I/O, no env reads.
//
// The edge function (index.ts W2 branch) attaches these as
// { error_code, error_message, next_action } on its error responses —
// HTTP statuses are unchanged by this module. The client
// (useClinicianSearch.ts) maps error_code to distinct toasts.

/** Stable wire codes — the client switches on these, never on message text. */
export type SearchErrorCode =
  | "no_results"
  | "empty_intent"
  | "provider_timeout"
  | "credit_ceiling"
  | "rate_limited"
  | "malformed_query"
  | "upstream_4xx"
  | "upstream_5xx";

export interface SearchErrorInfo {
  code: SearchErrorCode;
  /** Plain-language explanation of what went wrong (no provider jargon). */
  userMessage: string;
  /** What the user should do next: retry / widen / edit criteria. */
  nextAction: string;
}

/**
 * Failure conditions the W2 branch detects ITSELF (before or after the
 * upstream call) are passed as string tags; upstream failures are passed as
 * the V2Result error branch (see crustdata-v2.ts V2Result) so status /
 * busy / detail decide the classification.
 */
export type SearchFailureTag =
  | "no_results"
  | "empty_intent"
  | "malformed_query"
  | "credit_ceiling"
  | "provider_timeout";

/** Structural subset of crustdata-v2.ts V2Result's error branch. */
export interface V2ErrorLike {
  ok: false;
  status: number;
  detail?: string;
  /** US-009: rate-limited twice (or local token budget exhausted). */
  busy?: boolean;
  retryAfterMs?: number;
  insufficientCredits?: boolean;
}

export type SearchFailureCondition = SearchFailureTag | V2ErrorLike;

const TAXONOMY: Record<SearchErrorCode, SearchErrorInfo> = {
  empty_intent: {
    code: "empty_intent",
    userMessage: "Add a clinical role, specialty, employer, or credential so the search has something to match.",
    nextAction: "Examples: 'cardiologist', 'ICU nurse', 'CRNAs at the Miami VA'.",
  },
  no_results: {
    code: "no_results",
    userMessage: "No candidates matched every filter in this search.",
    nextAction: "Widen the search: drop a filter or expand a city to its state.",
  },
  provider_timeout: {
    code: "provider_timeout",
    userMessage: "The search took too long and timed out.",
    nextAction: "Retry the search — this is usually temporary.",
  },
  credit_ceiling: {
    code: "credit_ceiling",
    userMessage: "This search session reached its credit ceiling, so nothing new was fetched.",
    nextAction: "Edit the criteria or start a new search to continue.",
  },
  rate_limited: {
    code: "rate_limited",
    userMessage: "The search service is busy right now.",
    nextAction: "Retry in a few seconds — we'll take it from there.",
  },
  malformed_query: {
    code: "malformed_query",
    userMessage: "We couldn't turn that query into an enforceable search.",
    nextAction: "Edit the criteria: name a role, specialty, employer, or location.",
  },
  upstream_4xx: {
    code: "upstream_4xx",
    userMessage: "The search service rejected this request.",
    nextAction: "Edit the criteria and try again.",
  },
  upstream_5xx: {
    code: "upstream_5xx",
    userMessage: "The search service hit an internal error.",
    nextAction: "Retry the search in a moment.",
  },
};

const TIMEOUT_DETAIL = /time[d]?[\s-]?out|timeout|deadline exceeded/i;

/**
 * Classify a W2 failure condition into its taxonomy entry.
 *
 * V2Result error precedence (order matters):
 *  1. busy or HTTP 429            → rate_limited (US-009 busy state)
 *  2. HTTP 408/504 or timeout text → provider_timeout (incl. fetch aborts,
 *     which surface as status 502 with a timeout message in `detail`)
 *  3. any other 4xx               → upstream_4xx (e.g. invalid_request from
 *     a bad `fields` projection — filter-only fields like honors.* 400 there)
 *  4. everything else (5xx, 0)    → upstream_5xx
 */
export function classifySearchError(condition: SearchFailureCondition): SearchErrorInfo {
  if (typeof condition === "string") return TAXONOMY[condition];

  if (condition.busy === true || condition.status === 429) return TAXONOMY.rate_limited;
  if (
    condition.status === 408 ||
    condition.status === 504 ||
    TIMEOUT_DETAIL.test(condition.detail ?? "")
  ) {
    return TAXONOMY.provider_timeout;
  }
  if (condition.status >= 400 && condition.status < 500) return TAXONOMY.upstream_4xx;
  return TAXONOMY.upstream_5xx;
}

/**
 * Response-body fields for the wire (spread into the JSON payload).
 * Kept here so every W2 error path serializes identically.
 */
export function searchErrorFields(info: SearchErrorInfo): {
  error_code: SearchErrorCode;
  error_message: string;
  next_action: string;
} {
  return {
    error_code: info.code,
    error_message: info.userMessage,
    next_action: info.nextAction,
  };
}

/* ────────────────────────────────────────────────────────────────────
 * CONTACT-action taxonomy (client call 2026-08-28, the live bug):
 * a contact enrich that times out must NEVER surface search guidance
 * ("narrow the query" / "widen the search") — the batch contact path
 * legitimately takes minutes on cold profiles, and the honest next
 * action is retry/keep waiting, not editing a query that isn't there.
 * Separate code space so clients can switch without colliding with
 * the search codes.
 * ──────────────────────────────────────────────────────────────────── */

export type ContactErrorCode =
  | "contact_timeout"
  | "contact_rate_limited"
  | "contact_credit_exhausted"
  | "contact_failed";

export interface ContactErrorInfo {
  code: ContactErrorCode;
  userMessage: string;
  nextAction: string;
}

const CONTACT_TAXONOMY: Record<ContactErrorCode, ContactErrorInfo> = {
  contact_timeout: {
    code: "contact_timeout",
    userMessage: "Contact enrichment didn't finish — some profiles take a few minutes.",
    nextAction: "Retry the contact fetch; the lookup usually completes on a second attempt.",
  },
  contact_rate_limited: {
    code: "contact_rate_limited",
    userMessage: "Contact enrichment is briefly rate-limited.",
    nextAction: "Wait a few seconds and retry the contact fetch.",
  },
  contact_credit_exhausted: {
    code: "contact_credit_exhausted",
    userMessage: "Credit balance exhausted.",
    nextAction: "Top up credits, then retry.",
  },
  contact_failed: {
    code: "contact_failed",
    userMessage: "Contact lookup failed.",
    nextAction: "Retry once; if it persists this profile may have no reachable contact data.",
  },
};

/** Classify a contact-enrich failure. Same V2ErrorLike shape as the search classifier. */
export function classifyContactError(condition: V2ErrorLike): ContactErrorInfo {
  if (condition.busy === true || condition.status === 429) return CONTACT_TAXONOMY.contact_rate_limited;
  if (condition.status === 402 || condition.insufficientCredits === true) {
    return CONTACT_TAXONOMY.contact_credit_exhausted;
  }
  if (
    condition.status === 408 ||
    condition.status === 504 ||
    TIMEOUT_DETAIL.test(condition.detail ?? "")
  ) {
    return CONTACT_TAXONOMY.contact_timeout;
  }
  return CONTACT_TAXONOMY.contact_failed;
}
