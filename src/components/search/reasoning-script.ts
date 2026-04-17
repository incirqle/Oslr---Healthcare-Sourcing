import type { ReasoningLine } from "@/components/search/AgentReasoningPanel";
import type { ActiveFilter } from "@/components/search/ActiveFilterBar";
import type { ParsedFilters } from "@/components/search/FilterReview";

/**
 * Build the streamed reasoning script from real parse + search data.
 *
 * Lines are typed out client-side at ~40 chars/sec — they ARE the agent's
 * actual interpretation, not generic filler. Skip any line we can't fill
 * with a real value rather than fabricating.
 */
export function buildReasoningLines({
  rawQuery,
  filters,
  parsed,
  total,
  shownCount,
  geoExpanded,
  errored,
}: {
  rawQuery: string;
  filters: ParsedFilters;
  parsed: Record<string, unknown> | null;
  total: number;
  shownCount: number;
  geoExpanded?: boolean;
  errored?: boolean;
}): ReasoningLine[] {
  if (errored) {
    return [
      { kind: "header", text: "Something went wrong on my end." },
      { kind: "step", text: "→ Retry, or rephrase your search." },
    ];
  }

  const lines: ReasoningLine[] = [];

  // Phase 1: parsing
  lines.push({ kind: "header", text: "Parsing your query…" });

  if (filters.companies.length > 0) {
    lines.push({
      kind: "step",
      text: `→ Detected company: ${filters.companies.map(titleCase).join(", ")}`,
    });
  }
  if (filters.locations.length > 0) {
    lines.push({
      kind: "step",
      text: `→ Detected location: ${filters.locations.map(titleCase).join(", ")}`,
    });
  }
  if (filters.specialties.length > 0) {
    lines.push({
      kind: "step",
      text: `→ Specialty: ${filters.specialties.map(titleCase).join(", ")}`,
    });
  }
  if (filters.job_titles.length > 0) {
    const titles = filters.job_titles.slice(0, 3).map(titleCase).join(", ");
    lines.push({ kind: "step", text: `→ Role intent: ${titles}` });
  }
  if (filters.experience_years && filters.experience_years > 0) {
    lines.push({
      kind: "step",
      text: `→ Experience: ${filters.experience_years}+ years`,
    });
  }

  // Phase 2: expansion (anything in parsed that wasn't in the raw query)
  const expansionTerms = collectExpansionTerms(rawQuery, filters, parsed);
  if (expansionTerms.length > 0) {
    lines.push({ kind: "header", text: "Expanding search terms…" });
    lines.push({
      kind: "step",
      text: `→ Including related terms: ${expansionTerms.slice(0, 4).join(", ")}`,
    });
  }

  // Phase 3: scanning
  lines.push({ kind: "header", text: "Scanning healthcare professional records…" });
  if (geoExpanded) {
    lines.push({
      kind: "warn",
      text: "→ Few exact matches — widened the geographic scope",
    });
  }
  if (total > 0) {
    lines.push({ kind: "step", text: `→ ${total.toLocaleString()} matching records` });
    lines.push({ kind: "step", text: "→ Ranking by seniority and recency…" });
    lines.push({
      kind: "result",
      text: `Found ${total.toLocaleString()} candidates. Showing top ${Math.min(shownCount, total)} below.`,
    });
  } else {
    lines.push({
      kind: "warn",
      text: "I didn't find anyone matching all your criteria. Try removing the tightest constraint.",
    });
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

  // From parsed.required_keywords / specialties / synonyms not in raw query
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
