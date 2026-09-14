/**
 * semantic-recall.ts — natural-language recall for the hiring engine.
 *
 * ADDITIVE. This never replaces the structured search and can only ADD
 * candidates, always inside the same hard constraints (location, named
 * employer, sales function, award requirement). Everything it returns still
 * goes through match scoping, award ranking and the AI audit before a
 * recruiter sees it.
 *
 * Why it exists. Structured filters can only match text that is literally
 * written down. "Top reps at orthopedic trauma companies" only finds people
 * whose profile contains the word "trauma" — it cannot find the Stryker rep
 * whose headline says "Extremities & Upper Limb" but whose whole career is the
 * same call point, or the DePuy rep who writes "ortho recon and fracture
 * fixation". Those are the people a recruiter would take the meeting with, and
 * a substring search is structurally blind to them.
 *
 * Contract (Crustdata v2 Person Search, semantic mode):
 *   POST /person/search   x-api-version: 2025-11-01
 *   { search: { query, mode: "hybrid" }, mode: "exact", filters, limit }
 * `mode: "exact"` keeps the structured filters HARD; without it the provider
 * treats them as recall hints and geography quietly stops being enforced.
 *
 * Billing: 0.03 credits per returned row, same as the lexical search. The
 * caller decides whether the budget allows it.
 */

import { personSearchV2 } from "./lib/crustdata-v2.ts";
import type { SearchCriteria } from "./clinician-criteria.ts";

/** Rows to request. Kept modest: this is a recall supplement, not a re-search. */
export const SEMANTIC_LIMIT = 50;

export interface SemanticRecallInput {
  /** The recruiter's original sentence, verbatim. */
  query: string;
  /** The same hard filter tree the lexical search used. */
  filters: Record<string, unknown>;
  fields: string[];
  limit?: number;
}

export interface SemanticRecallResult {
  profiles: Record<string, unknown>[];
  /** True when the provider accepted and answered the semantic call. */
  ran: boolean;
  reason?: string;
}

/**
 * Should a semantic pass run for this search?
 *
 * Only when it can actually add something. A query pinned to a named employer
 * plus an award is already precise and semantic recall would spend credits to
 * return the same people. A query resting on a specialty word — the case where
 * a substring is doing work it cannot do — is exactly where it pays.
 */
export function semanticWorthRunning(criteria: SearchCriteria[]): boolean {
  const hasSpecialty = criteria.some((c) => c.kind === "specialty" && c.enforcement === "hard");
  const hasNamedEmployer = criteria.some((c) => c.kind === "company" || c.kind === "employer_group");
  return hasSpecialty && !hasNamedEmployer;
}

/**
 * Run one semantic pass under the same hard constraints as the lexical search.
 *
 * Degrades silently: any provider failure returns `ran: false` with no rows,
 * because a recall supplement must never be able to fail a search that already
 * has answers.
 */
export async function semanticRecall(
  input: SemanticRecallInput,
): Promise<SemanticRecallResult> {
  const query = input.query?.trim();
  if (!query) return { profiles: [], ran: false, reason: "empty query" };

  const r = await personSearchV2({
    filters: input.filters,
    search: { query, mode: "hybrid" },
    mode: "exact",
    fields: input.fields,
    limit: input.limit ?? SEMANTIC_LIMIT,
  });

  if (!r.ok) {
    // r is the error arm of the union here, so status/detail are present.
    console.warn(`[semantic] provider declined (${r.status}) — lexical results stand`);
    return { profiles: [], ran: false, reason: `provider ${r.status}` };
  }
  return { profiles: r.data.profiles ?? [], ran: true };
}

/**
 * Merge semantic rows into the lexical rows, lexical first.
 *
 * Lexical matches satisfied the literal ask and keep their order and their
 * ranking. Semantic rows are recall — they append, and only when they are
 * genuinely new. De-duplicated on LinkedIn URL, falling back to the provider's
 * person id and then to name plus current employer.
 */
export function mergeSemanticRows(
  lexical: Record<string, unknown>[],
  semantic: Record<string, unknown>[],
  keyOf: (row: Record<string, unknown>) => string | null,
): { merged: Record<string, unknown>[]; added: number } {
  const seen = new Set<string>();
  for (const row of lexical) {
    const k = keyOf(row);
    if (k) seen.add(k);
  }
  const additions: Record<string, unknown>[] = [];
  for (const row of semantic) {
    const k = keyOf(row);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    row._semantic_recall = true;
    additions.push(row);
  }
  return { merged: [...lexical, ...additions], added: additions.length };
}
