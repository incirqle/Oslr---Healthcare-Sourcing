/**
 * credit-budget.ts — per-search credit ceiling + cache key for the W2
 * Crustdata lane (US-007). Everything here is pure and dependency-free so it
 * is testable without the server, Supabase, or the live API.
 *
 * Spend model (PRD §8 / demo/server.mjs CREDIT_CEILING):
 *   - /person/search v2 pro-rates 0.03 credits per returned result.
 *   - Hard ceiling: 6 credits per search session. A "session" is one user
 *     query plus its user-approved widen rounds (removeIds / cityToState),
 *     keyed on the PRE-relaxation criteria hash + user id, so every widen
 *     round of the same query accrues into the same budget.
 *   - The ceiling check is conservative: it projects the WORST-CASE cost of
 *     the planned call (limit × 0.03) against what is already spent. If the
 *     projection exceeds the ceiling the caller must NOT call the API — it
 *     logs an error and returns whatever is already fetched (cache) instead.
 *
 * Session ledger: in-memory Map, TTL-bounded (caller passes SEARCH_TTL_MS so
 * the budget window matches the search cache window). In-memory is a deliberate
 * choice for the LEDGER only — the search cache itself uses the service-role
 * crustdata_cache table (fetch-crustdata-results.ts) — because no session
 * table exists and adding a migration is out of scope for this story; a cold
 * start resets the ledger, which fails OPEN (never blocks a legitimate first
 * search) and the cache still prevents duplicate spend for identical criteria.
 */

import type { SearchCriteria } from "./clinician-criteria.ts";

export const CREDIT_CEILING = 6;
export const COST_PER_RESULT = 0.03;
/** One page of card results; also the worst-case result count per search. */
export const SEARCH_LIMIT = 50;

/** Round to cents so accumulated 0.03s never drift (0.1 + 0.2 !== 0.3). */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Pro-rated search cost: results × 0.03, rounded to cents. */
export function creditsForResults(resultCount: number): number {
  return round2(Math.max(0, resultCount) * COST_PER_RESULT);
}

export interface CeilingDecision {
  /** true → the planned call fits under the ceiling even at worst case. */
  allow: boolean;
  /** Credits already spent this session. */
  spent: number;
  /** spent + worst-case cost of the planned call (limit × 0.03). */
  projected: number;
  /** Ceiling headroom before the planned call (never negative). */
  remaining: number;
}

/**
 * Would a search of `plannedLimit` results exceed the session ceiling?
 * Worst-case projection: a call may return up to `plannedLimit` results, and
 * spend is only known after the response, so the gate assumes the maximum.
 * Exactly reaching the ceiling (projected === ceiling) is allowed.
 */
export function checkCeiling(
  spentCredits: number,
  plannedLimit: number,
  ceiling: number = CREDIT_CEILING,
): CeilingDecision {
  const spent = round2(Math.max(0, spentCredits));
  const projected = round2(spent + creditsForResults(plannedLimit));
  return {
    allow: projected <= ceiling,
    spent,
    projected,
    remaining: round2(Math.max(0, ceiling - spent)),
  };
}

/* ------------------------------------------------------------------ */
/*  Session spend ledger (in-memory, TTL-bounded)                      */
/* ------------------------------------------------------------------ */

export interface LedgerEntry {
  spent: number;
  /** Session anchor: timestamp of the FIRST spend. The window is NOT sliding —
   * the budget expires with the first search's cache entry (same TTL). */
  at: number;
}

export type CreditLedger = Map<string, LedgerEntry>;

/** Module-level default ledger for index.ts. Tests build their own Maps. */
export const creditLedger: CreditLedger = new Map();

/** Credits spent so far this session; expired entries are evicted and read 0. */
export function getSessionSpend(
  ledger: CreditLedger,
  key: string,
  ttlMs: number,
  now: number = Date.now(),
): number {
  const e = ledger.get(key);
  if (!e) return 0;
  if (now - e.at > ttlMs) {
    ledger.delete(key);
    return 0;
  }
  return e.spent;
}

/** Add credits to the session; returns the new session total. */
export function recordSessionSpend(
  ledger: CreditLedger,
  key: string,
  credits: number,
  ttlMs: number,
  now: number = Date.now(),
): number {
  const prior = getSessionSpend(ledger, key, ttlMs, now); // evicts if expired
  const existing = ledger.get(key); // survives only when un-expired
  const spent = round2(prior + Math.max(0, credits));
  ledger.set(key, { spent, at: existing?.at ?? now });
  return spent;
}

/* ------------------------------------------------------------------ */
/*  Cache key — hash of the RESOLVED criteria                          */
/* ------------------------------------------------------------------ */

/** Recursively sort object keys so JSON.stringify is insertion-order-proof. */
function canonicalize(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(canonicalize);
  if (v && typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(v as Record<string, unknown>).sort()) {
      const val = (v as Record<string, unknown>)[k];
      if (val === undefined) continue; // {a:1} and {a:1,b:undefined} hash alike
      out[k] = canonicalize(val);
    }
    return out;
  }
  return v;
}

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Cache key over the RESOLVED criteria (post-relaxation, post-identify) +
 * limit — mirroring buildCacheKey(filters, limit) in fetch-crustdata-results.
 * Only filter-determining fields participate: kind, enforcement, value
 * (including any resolved company_id). id and label are EXCLUDED so that two
 * routes to the same resolved search — e.g. a direct "Texas" query vs a
 * Dallas query widened city→state — share one cache entry. Criteria with
 * enforcement "dropped" (audit defect 4's surfaced-but-unenforced concepts)
 * are excluded for the same reason: they never touch the filter tree, so two
 * queries differing only in unmappable concepts run the identical search and
 * must hit one cache row. The "clin:" prefix keeps keys disjoint from the
 * other rows in crustdata_cache.
 */
export async function buildSearchCacheKey(
  criteria: SearchCriteria[],
  limit: number,
  fields: readonly string[] = [],
): Promise<string> {
  const canon = criteria
    .filter((c) => c.enforcement !== "dropped")
    .map((c) =>
      canonicalize({ kind: c.kind, enforcement: c.enforcement, value: c.value })
    );
  // The `fields` projection participates in the key: a deploy that widens
  // the card projection must MISS old cache rows rather than serve profiles
  // lacking the new fields for a full TTL window (e.g. cards without
  // employer ids silently falling back to name-based company enrich).
  return "clin:" +
    await sha256Hex(JSON.stringify(canon) + "|" + String(limit) + "|" + fields.join(","));
}
