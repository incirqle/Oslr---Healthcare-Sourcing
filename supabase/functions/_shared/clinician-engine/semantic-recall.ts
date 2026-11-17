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

/** One bounded semantic page on every search (provider maximum: 100). */
export const SEMANTIC_LIMIT = 100;
/** Extra targeted page for nursing-management word-order variants. */
export const SEMANTIC_TITLE_LIMIT = 50;

export interface SemanticRecallInput {
  /** The recruiter's original sentence, verbatim. */
  query: string;
  /** The same hard filter tree the lexical search used. */
  filters: Record<string, unknown>;
  fields: string[];
  limit?: number;
  /** Additional bounded semantic phrasings, merged into the same recall pool. */
  additionalQueries?: string[];
}

export interface SemanticRecallResult {
  profiles: Record<string, unknown>[];
  /** True when the provider accepted and answered the semantic call. */
  ran: boolean;
  reason?: string;
}

/**
 * Semantic discovery runs on every valid search, not only specialty searches.
 * Clinical titles vary too much for literal matching to be the primary recall
 * strategy: "Manager of Emergency Services" and "Clinical Nurse Manager - ED"
 * are the same recruiting target as "Emergency Room Nurse Manager".
 */
export function semanticWorthRunning(criteria: SearchCriteria[]): boolean {
  return criteria.some((c) => c.enforcement === "hard");
}

/**
 * Semantic discovery needs room to recognize equivalent title and specialty
 * language. Those two text filters therefore stay out of the provider-side
 * semantic request; the original criteria still rank and grade every row.
 * Geography, named employers, role classes, credentials, career stage and all
 * other hard boundaries remain in exact mode.
 */
export function semanticFilterCriteria(criteria: SearchCriteria[]): SearchCriteria[] {
  return criteria.filter((c) =>
    c.kind !== "title" && c.kind !== "specialty" && c.kind !== "seniority"
  );
}

/**
 * A second semantic phrasing for nursing-management titles. Literal and
 * single-query semantic search both over-recall bedside nurses; real leaders
 * also use "Clinical Nurse Manager, ED" and "Manager of Emergency Services".
 * The variant is derived from stated/autocomplete titles, never invented as a
 * new requirement, and the original sentence always remains the first query.
 */
export function semanticDiscoveryQueries(query: string, criteria: SearchCriteria[]): string[] {
  const original = query.trim();
  const titleTerms = criteria
    .filter((c) => c.kind === "title" && c.enforcement === "hard")
    .flatMap((c) => {
      const value = c.value as { terms?: string[] } | string[] | null;
      return Array.isArray(value) ? value : value?.terms ?? [];
    })
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  const variants = new Set(titleTerms);
  for (const title of titleTerms) {
    if (!/\b(?:nurse|nursing) manager\b/.test(title)) continue;
    variants.add(title.replace(/\b(?:nurse|nursing) manager\b/, "clinical nurse manager"));
    const prefix = title.replace(/\b(?:nurse|nursing) manager\b.*$/, "").trim();
    if (prefix) variants.add(`clinical nurse manager ${prefix}`);
  }
  if (variants.size === titleTerms.length || titleTerms.length === 0) return [original];
  return [
    original,
    `Current ${[...variants].join(", ")}, or equivalent clinical leadership roles. ${original}`,
  ];
}

/**
 * Run semantic passes under the same hard constraints as the lexical search.
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

  const requests = [
    { query, limit: input.limit ?? SEMANTIC_LIMIT },
    ...(input.additionalQueries ?? []).map((q) => ({ query: q, limit: Math.min(SEMANTIC_TITLE_LIMIT, input.limit ?? SEMANTIC_TITLE_LIMIT) })),
  ];
  const responses = await Promise.all(requests.map((request) => personSearchV2({
    filters: input.filters,
    search: { query: request.query, mode: "hybrid" },
    mode: "exact",
    fields: input.fields,
    limit: request.limit,
  })));

  const profiles: Record<string, unknown>[] = [];
  let ran = false;
  let lastStatus: number | null = null;
  for (const r of responses) {
    if (!r.ok) {
      lastStatus = r.status;
      console.warn(`[semantic] provider declined (${r.status}) — lexical results stand`);
      continue;
    }
    ran = true;
    profiles.push(...(r.data.profiles ?? []));
  }
  return ran
    ? { profiles, ran: true }
    : { profiles: [], ran: false, reason: lastStatus ? `provider ${lastStatus}` : "no response" };
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
