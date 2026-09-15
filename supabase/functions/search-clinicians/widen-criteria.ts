/**
 * widen-criteria.ts — user-initiated widening for the W2 Crustdata lane (US-006).
 *
 * The W2 lane never auto-relaxes (no cascade). When results are thin the
 * response offers labelled widen options; the client re-searches with
 * `removeIds` / `cityToState` and the applied relaxations are echoed back as
 * `relaxed` labels. Both functions are pure (no mutation of the input array or
 * its criteria) so they are testable without the server.
 *
 * Ported from the verified demo: widenOptions() from demo/parser.mjs, the
 * relax application from demo/server.mjs handleSearch().
 *
 * Criterion-id determinism contract: mapParsedToCriteria() assigns sequential
 * ids c0..cN in a fixed section order, so ids are stable for an identical
 * parsed payload. Across requests that is only guaranteed when the client
 * re-sends `cached_parsed` (parseQuery skips the LLM and normalizes the same
 * object); a fresh LLM parse of the same query text is not byte-guaranteed.
 * Widen re-searches should therefore carry `cached_parsed`.
 */

import type { LocationValue, SearchCriteria } from "./clinician-criteria.ts";

export type WidenAction = "city_to_state" | "drop";

export interface WidenOption {
  action: WidenAction;
  label: string;
  targetId: string;
}

/** Criteria values are stored lowercased; labels shown to users are cased. */
function titleCase(s: string): string {
  return s.replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

/**
 * Widen options offered when results are thin (total < 10).
 *
 * - city_to_state when a city-level location criterion exists.
 * - drop per non-anchor hard criterion:
 *   - company is skipped — the named company is the search's anchor;
 *   - USER location is skipped — state is the floor for locations the user
 *     stated, and a city-level location is widened via city_to_state above,
 *     never dropped. The INFERRED "United States (default)" country criterion
 *     (audit defect 2) is NOT protected by the floor — it IS offered as a
 *     drop so international searches stay one click away.
 * - soft / dropped criteria are not offered (nothing to relax).
 */
export function widenOptions(criteria: SearchCriteria[]): WidenOption[] {
  const opts: WidenOption[] = [];

  const loc = criteria.find((c) => c.kind === "location");
  if (loc && (loc.value as LocationValue).level === "city") {
    const v = loc.value as LocationValue;
    opts.push({
      action: "city_to_state",
      label: `Widen ${titleCase(v.city ?? "")} → all of ${titleCase(v.state ?? "")}`,
      targetId: loc.id,
    });
  }
  // Sub-state region → state rides the same wire action (the client already
  // knows how to re-send cityToState: true); multi_state is already broad.
  if (loc && (loc.value as LocationValue).level === "region") {
    const v = loc.value as LocationValue;
    opts.push({
      action: "city_to_state",
      label: `Widen ${loc.label} → all of ${titleCase(v.state ?? "")}`,
      targetId: loc.id,
    });
  }

  for (const c of criteria) {
    if (c.enforcement !== "hard") continue;
    // A named employer (or employer group like the VA) is the search's anchor.
    if (c.kind === "company" || c.kind === "employer_group") continue;
    // Location floor applies to USER criteria only; the inferred country
    // default is droppable.
    if (c.kind === "location" && c.source === "user") continue;
    opts.push({ action: "drop", label: `Drop "${c.label}"`, targetId: c.id });
  }

  return opts;
}

/* ------------------------------------------------------------------ */
/*  Remarks-guided ladder ordering (2026-09-15)                        */
/* ------------------------------------------------------------------ */

/**
 * Map the field paths a zero-result remark names to the ladder rungs they
 * implicate, and move those rungs to the front (stable otherwise). The
 * provider's `remarks[]` say WHICH condition emptied the result
 * ("condition_eliminates_all … 77 match without it" — probe log D); walking
 * a blind fixed order past the culprit wastes free probes and can widen the
 * wrong requirement first.
 */
const REMARK_FIELD_TO_KINDS: ReadonlyArray<{ pattern: RegExp; kinds: string[] }> = [
  { pattern: /skills|summary|headline|description/, kinds: ["specialty"] },
  { pattern: /education\./, kinds: ["fellowship", "credential"] },
  { pattern: /company_headcount/, kinds: ["employer_size"] },
  { pattern: /company_name|company_website_domain/, kinds: ["care_setting"] },
  { pattern: /current\.title|past\.title/, kinds: ["title", "specialty"] },
  { pattern: /seniority_level/, kinds: ["seniority"] },
];

export interface LadderRung {
  kind: string;
  note: string;
}

export function reorderLadderByRemarks(
  ladder: LadderRung[],
  remarks: Array<Record<string, unknown>>,
): LadderRung[] {
  if (!Array.isArray(remarks) || remarks.length === 0) return ladder;
  const implicated = new Set<string>();
  for (const r of remarks) {
    const text = `${r.message ?? ""} ${r.path ?? ""} ${r.hint ?? ""}`.toLowerCase();
    for (const { pattern, kinds } of REMARK_FIELD_TO_KINDS) {
      if (pattern.test(text)) for (const k of kinds) implicated.add(k);
    }
  }
  if (implicated.size === 0) return ladder;
  const first = ladder.filter((r) => implicated.has(r.kind));
  const rest = ladder.filter((r) => !implicated.has(r.kind));
  return [...first, ...rest];
}

export interface RelaxationResult {
  /** New array; surviving criteria keep their original ids. */
  criteria: SearchCriteria[];
  /** Human-readable labels of every relaxation applied, for the response echo. */
  relaxed: string[];
}

/**
 * Apply user-requested relaxations to a criteria array BEFORE the filter is
 * built. Never silent: every change is echoed in `relaxed`.
 *
 * - cityToState=true converts every city-level location criterion to its
 *   state (id preserved, label becomes the state).
 * - removeIds drops the matching criteria entirely; unknown ids are ignored.
 */
export function applyRelaxations(
  criteria: SearchCriteria[],
  removeIds: string[],
  cityToState: boolean,
): RelaxationResult {
  const relaxed: string[] = [];
  let next: SearchCriteria[] = [...criteria];

  if (cityToState) {
    next = next.map((c) => {
      if (c.kind !== "location") return c;
      const v = c.value as LocationValue;
      if ((v.level !== "city" && v.level !== "region") || !v.state) return c;
      const fromLabel = v.level === "region" ? c.label : titleCase(v.city ?? "");
      relaxed.push(`${fromLabel} → ${titleCase(v.state)}`);
      return {
        ...c,
        label: titleCase(v.state),
        value: { level: "state", state: v.state } as LocationValue,
      };
    });
  }

  for (const id of removeIds) {
    const dropped = next.find((c) => c.id === id);
    if (!dropped) continue;
    relaxed.push(`dropped "${dropped.label}"`);
    next = next.filter((c) => c.id !== id);
  }

  return { criteria: next, relaxed };
}
