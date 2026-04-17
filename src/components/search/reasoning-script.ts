import type { ReasoningLine } from "@/components/search/AgentReasoningPanel";
import type { ActiveFilter } from "@/components/search/ActiveFilterBar";
import type { ParsedFilters } from "@/components/search/FilterReview";

/**
 * Build the streamed reasoning script — kept intentionally terse (≤3 lines).
 *
 * The active filter chip bar below already shows the parsed filters and
 * AI expansions, so the reasoning narrative does NOT repeat them. It just
 * narrates the three phases: parse → expand (if any) → result count.
 *
 * Critically, we DO NOT emit a zero-state line until the caller passes
 * `searchComplete: true`. This prevents the "couldn't find anyone" message
 * from flashing during the in-flight phase when total is briefly 0.
 */
export function buildReasoningLines({
  rawQuery,
  filters,
  parsed,
  total,
  shownCount,
  geoExpanded,
  errored,
  searchComplete,
}: {
  rawQuery: string;
  filters: ParsedFilters;
  parsed: Record<string, unknown> | null;
  total: number;
  shownCount: number;
  geoExpanded?: boolean;
  errored?: boolean;
  /** True once the search request has resolved (success or zero results). */
  searchComplete?: boolean;
}): ReasoningLine[] {
  if (errored) {
    return [{ kind: "warn", text: "Something went wrong on my end. Try again or rephrase." }];
  }

  const lines: ReasoningLine[] = [];

  // Line 1: parsing — always present once we have any signal.
  lines.push({ kind: "header", text: "Parsed your query." });

  // Line 2: expansion — only if AI added terms beyond the raw query.
  const expansionTerms = collectExpansionTerms(rawQuery, filters, parsed);
  if (expansionTerms.length > 0) {
    lines.push({ kind: "step", text: "Expanded to related terms." });
  }

  // Line 3: result — ONLY after the search has actually completed.
  if (searchComplete) {
    if (total > 0) {
      const shown = Math.min(shownCount || total, total);
      const geoNote = geoExpanded ? " (widened to nearby areas)" : "";
      lines.push({
        kind: "result",
        text: `Found ${total.toLocaleString()} candidates${geoNote}. Showing top ${shown}.`,
      });
    } else {
      lines.push({
        kind: "warn",
        text: "No matches for all your criteria. Try removing the tightest constraint.",
      });
    }
  } else {
    // Mid-flight: show a neutral scanning line so the panel isn't empty.
    lines.push({ kind: "step", text: "Scanning healthcare professional records…" });
  }

  return lines;
}

/**
 * Compare parsed filter values against the raw query string to determine
 * which were typed by the user vs added by the AI as expansions.
 *
 * Imperfect substring match — works ~90% of the time and stays cheap.
 */
export function classifyFilters(rawQuery: string, filters: ParsedFilters): ActiveFilter[] {
  const q = rawQuery.toLowerCase();
  const out: ActiveFilter[] = [];

  const add = (
    group: ActiveFilter["group"],
    values: string[],
    idPrefix: string,
  ) => {
    for (const v of values) {
      if (!v) continue;
      const fromUser = q.includes(v.toLowerCase());
      out.push({
        id: `${idPrefix}-${v}`,
        label: titleCase(v),
        group,
        fromUser,
      });
    }
  };

  add("Company", filters.companies, "co");
  add("Location", filters.locations, "loc");
  add("Specialty", filters.specialties, "spec");
  add("Title", filters.job_titles, "title");
  add("Keyword", filters.keywords, "kw");
  if (filters.experience_years && filters.experience_years > 0) {
    out.push({
      id: `exp-${filters.experience_years}`,
      label: `${filters.experience_years}+ yrs`,
      group: "Experience",
      fromUser: q.includes("year") || q.includes("yr") || /\d+\+?/.test(q),
    });
  }

  return out;
}

function collectExpansionTerms(
  rawQuery: string,
  filters: ParsedFilters,
  parsed: Record<string, unknown> | null,
): string[] {
  const q = rawQuery.toLowerCase();
  const terms = new Set<string>();
  const seen = new Set<string>();

  const pull = (arr: unknown): string[] =>
    Array.isArray(arr) ? arr.filter((v): v is string => typeof v === "string") : [];

  const candidates = [
    ...pull(parsed?.required_keywords),
    ...pull(parsed?.keywords),
    ...pull(parsed?.specialties),
    ...filters.keywords,
    ...filters.specialties,
  ];

  for (const c of candidates) {
    const lower = c.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);
    if (!q.includes(lower)) terms.add(titleCase(c));
  }

  return [...terms];
}

function titleCase(s: string): string {
  return s
    .split(/\s+/)
    .map((w) => (w.length <= 3 ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join(" ");
}
