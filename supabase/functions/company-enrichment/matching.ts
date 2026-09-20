/**
 * matching.ts — company identification helpers for company-enrichment.
 *
 * Pure functions, no I/O, so the matching rules are testable on their own.
 *
 * Why this exists (Neuvora beta audit, 2026-09-20): identifyByName accepted
 * any candidate sharing ONE 4+ letter token with the query, so "Auzenne
 * Pain" pulled 25 entities on the word "pain", and the primary was then
 * picked mostly by headcount — a large unrelated company outranked the
 * actual small practice, and the company panel showed 0 leaders.
 */

/** Words that name a kind of company, not a company. Never evidence of a match. */
export const GENERIC_NAME_TOKENS: ReadonlySet<string> = new Set([
  "pain", "care", "health", "healthcare", "clinic", "clinics", "center", "centers",
  "centre", "medical", "medicine", "group", "groups", "associates", "hospital",
  "hospitals", "services", "service", "system", "systems", "partners", "physicians",
  "physician", "surgery", "surgical", "surgeons", "management", "specialists",
  "specialist", "family", "practice", "wellness", "institute", "network", "orthopedic",
  "orthopedics", "orthopaedic", "orthopaedics", "spine", "sports", "rehab",
  "rehabilitation", "therapy", "dental", "vision", "urgent", "primary", "regional",
  "national", "american", "university", "community", "general", "southern", "northern",
  "eastern", "western", "central", "north", "south", "east", "west", "the", "and", "of",
  "inc", "llc", "llp", "pllc", "pc", "pa", "ltd", "corp", "company", "co",
]);

export function nameTokens(name: string): string[] {
  return name.toLowerCase().split(/\W+/).filter(Boolean);
}

/** Tokens that could only belong to this company (proper-noun-ish). */
export function distinctiveTokens(name: string): string[] {
  return nameTokens(name).filter((t) => t.length >= 3 && !GENERIC_NAME_TOKENS.has(t));
}

// deno-lint-ignore no-explicit-any
export function headcountRank(c: any): number {
  if (typeof c?.linkedin_headcount === "number" && c.linkedin_headcount > 0) {
    return c.linkedin_headcount;
  }
  const range: string | undefined = c?.employee_count_range;
  if (!range) return 0;
  const m = range.match(/(\d+)/g);
  if (!m) return 0;
  return parseInt(m[m.length - 1], 10) || 0;
}

/** Minimum name/domain evidence for a candidate to be the primary at all. */
export const MIN_PRIMARY_EVIDENCE = 50;
/** Cap on related entity ids folded into one company's entity set. */
export const MAX_RELATED_ENTITY_IDS = 10;

/**
 * Pick the primary entity. Evidence order: domain (1000) > full-domain
 * flag (500) > exact name (200) > name prefix (150) > every distinctive
 * token present (120) > some distinctive token present (60). Headcount is
 * a tie-breaker worth at most 20 points — it can no longer outrank a name
 * match. With a name or domain to match against and no evidence at all,
 * returns null: "no company found" beats the wrong company.
 */
export function pickBestCandidate(
  // deno-lint-ignore no-explicit-any
  candidates: any[],
  name: string | null,
  domain: string | null,
  // deno-lint-ignore no-explicit-any
): any | null {
  if (!Array.isArray(candidates) || candidates.length === 0) return null;
  const wantName = (name ?? "").toLowerCase().trim();
  const wantDomain = (domain ?? "").toLowerCase().trim().replace(/^www\./, "");
  const wantDistinct = wantName ? distinctiveTokens(wantName) : [];
  const scored = candidates.map((c) => {
    let score = 0;
    const cName = String(c?.company_name ?? "").toLowerCase().trim();
    const cTokens = new Set(nameTokens(cName));
    const cDomain = String(c?.company_website_domain ?? "")
      .toLowerCase()
      .trim()
      .replace(/^www\./, "");
    if (wantDomain && cDomain === wantDomain) score += 1000;
    if (c?.is_full_domain_match) score += 500;
    if (wantName && cName === wantName) score += 200;
    if (wantName && cName.startsWith(wantName)) score += 150;
    if (wantDistinct.length > 0) {
      const present = wantDistinct.filter((t) => cTokens.has(t)).length;
      if (present === wantDistinct.length) score += 120;
      else if (present > 0) score += 60;
    }
    score += Math.min(headcountRank(c), 20_000) / 1000;
    return { c, score };
  });
  scored.sort((a, b) => b.score - a.score);
  const top = scored[0];
  if ((wantName || wantDomain) && top.score < MIN_PRIMARY_EVIDENCE) return null;
  return top.c;
}

/**
 * The entity set for talent-flow / jobs queries: the primary plus
 * candidates that share a DISTINCTIVE token with the canonical name. A
 * name with no distinctive tokens ("Pain Management Group") requires every
 * token to be present. Capped so one generic word cannot fan out to 25
 * unrelated companies.
 */
export function selectRelatedEntityIds(
  // deno-lint-ignore no-explicit-any
  candidates: any[],
  primaryId: number,
  canonicalName: string,
  cap: number = MAX_RELATED_ENTITY_IDS,
): number[] {
  const all = nameTokens(canonicalName);
  const distinct = distinctiveTokens(canonicalName);
  const out: number[] = [primaryId];
  for (const c of candidates) {
    if (out.length >= cap) break;
    const id = c?.company_id;
    if (typeof id !== "number" || out.includes(id)) continue;
    const cTokens = new Set(nameTokens(String(c.company_name ?? "")));
    const related = distinct.length > 0
      ? distinct.some((t) => cTokens.has(t))
      : all.length > 0 && all.every((t) => cTokens.has(t));
    if (related) out.push(id);
  }
  return out;
}
