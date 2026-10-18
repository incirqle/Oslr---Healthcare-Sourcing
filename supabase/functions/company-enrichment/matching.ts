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

// deno-lint-ignore no-explicit-any
function domainsOf(c: any): Set<string> {
  const out = new Set<string>();
  const add = (d: unknown) => {
    if (typeof d !== "string") return;
    const s = d.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
    if (s.includes(".")) out.add(s);
  };
  add(c?.company_website_domain);
  if (Array.isArray(c?.all_domains)) c.all_domains.forEach(add);
  return out;
}

/** Legal and filler words that are not part of how people write a practice's name. */
const LEGAL_SUFFIX_TOKENS: ReadonlySet<string> = new Set([
  "management", "pa", "p", "a", "pllc", "llc", "llp", "inc", "pc", "ltd", "corp",
  "co", "company", "md", "m", "d", "do", "dds", "dmd", "sc", "lp", "plc",
]);

/**
 * The name as staff write it on their own profiles: lowercase words, legal
 * suffixes and a leading "the" removed.
 *   "DALLAS PLASTIC SURGERY INSTITUTE MANAGEMENT, PA" → "dallas plastic surgery institute"
 *   "Bone and Joint Institute of Tennessee"          → "bone and joint institute of tennessee"
 */
export function coreName(name: string): string {
  const toks = nameTokens(name.replace(/&/g, " and "));
  while (toks.length > 1 && LEGAL_SUFFIX_TOKENS.has(toks[toks.length - 1])) toks.pop();
  if (toks.length > 1 && toks[0] === "the") toks.shift();
  return toks.join(" ");
}

/** Whole-phrase containment on word boundaries ("rush university" is in "rush university medical center"). */
export function containsPhrase(haystack: string, phrase: string): boolean {
  if (!phrase) return false;
  return ` ${coreName(haystack)} `.includes(` ${phrase} `) ||
    ` ${nameTokens(haystack.replace(/&/g, " and ")).join(" ")} `.includes(` ${phrase} `);
}

/**
 * The entity set for roster and talent-flow queries: the primary plus its
 * true siblings (duplicate records, doctor-named pages of one practice,
 * hospital fragments of one system).
 *
 * A candidate joins when it shares a website domain with the primary, OR
 * its name contains the primary's whole core name as a phrase AND it does
 * not have a different website of its own while the primary has one.
 *
 * History:
 *  - Before 2026-10-18 ANY one distinctive token was enough: "Bone and
 *    Joint Institute of Tennessee" pulled in nine other "Bone and Joint"
 *    practices, and "Dallas Plastic Surgery Institute" pulled unrelated
 *    "Plastic Surgery" pages (India, Lebanon), which is where the panel's
 *    "Medical Assistant at Plastic Surgery" hires came from.
 *  - The first fix required every distinctive token. Live identify for
 *    Dallas Plastic Surgery Institute (2026-10-18) still admitted "North
 *    Dallas Plastic Surgery Associates" and "Clinique Dallas Plastic
 *    Surgery" (dallas + plastic). The whole-phrase rule keeps them out and
 *    keeps "Sam Jejurikar M.D., Dallas Plastic Surgery Institute" and "John
 *    Burns MD - Dallas Plastic Surgery Institute" in.
 */
export function selectRelatedEntityIds(
  // deno-lint-ignore no-explicit-any
  candidates: any[],
  primaryId: number,
  canonicalName: string,
  cap: number = MAX_RELATED_ENTITY_IDS,
): number[] {
  const phrase = coreName(canonicalName);
  const primary = candidates.find((c) => c?.company_id === primaryId);
  const primaryDomains = primary ? domainsOf(primary) : new Set<string>();
  const out: number[] = [primaryId];
  for (const c of candidates) {
    if (out.length >= cap) break;
    const id = c?.company_id;
    if (typeof id !== "number" || out.includes(id)) continue;
    const cDomains = domainsOf(c);
    const sharesDomain = [...cDomains].some((d) => primaryDomains.has(d));
    if (sharesDomain) {
      out.push(id);
      continue;
    }
    const ownWebsiteElsewhere = cDomains.size > 0 && primaryDomains.size > 0;
    if (ownWebsiteElsewhere) continue;
    if (phrase && containsPhrase(String(c.company_name ?? ""), phrase)) out.push(id);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Employment-entry matcher (ids + the practice's written name)        */
/* ------------------------------------------------------------------ */

/**
 * Live 2026-10-18, Dallas Plastic Surgery Institute: 6 people have a
 * current entry linked to the practice's three company ids, 49 have one
 * whose NAME is the practice with company id 0 (an unlinked entry),
 * including the founding surgeons. Matching on ids alone misses most of a
 * private practice. The matcher accepts:
 *   - an entry whose company id is in the entity set, or
 *   - an unlinked entry (id 0/missing) whose name contains the core name
 *     as a whole phrase, when that phrase is specific enough (2+ words and
 *     at least one distinctive word) and the person is in the practice's
 *     state when both are known (drops a Reno surgeon whose 2018 fellowship
 *     entry at the Dallas practice was never closed).
 */
export interface EntityMatcher {
  ids: Set<number>;
  /** Null when the name is too generic to match on ("Pain Management Group"). */
  phrase: string | null;
  hqState: string | null;
}

const US_STATES: Record<string, string> = {
  al: "alabama", ak: "alaska", az: "arizona", ar: "arkansas", ca: "california", co: "colorado",
  ct: "connecticut", de: "delaware", dc: "district of columbia", fl: "florida", ga: "georgia",
  hi: "hawaii", id: "idaho", il: "illinois", in: "indiana", ia: "iowa", ks: "kansas",
  ky: "kentucky", la: "louisiana", me: "maine", md: "maryland", ma: "massachusetts",
  mi: "michigan", mn: "minnesota", ms: "mississippi", mo: "missouri", mt: "montana",
  ne: "nebraska", nv: "nevada", nh: "new hampshire", nj: "new jersey", nm: "new mexico",
  ny: "new york", nc: "north carolina", nd: "north dakota", oh: "ohio", ok: "oklahoma",
  or: "oregon", pa: "pennsylvania", ri: "rhode island", sc: "south carolina",
  sd: "south dakota", tn: "tennessee", tx: "texas", ut: "utah", vt: "vermont", va: "virginia",
  wa: "washington", wv: "west virginia", wi: "wisconsin", wy: "wyoming",
};

/** "TX", "Texas", " texas " → "texas". */
export function normState(s: string | null | undefined): string | null {
  if (typeof s !== "string" || !s.trim()) return null;
  const v = s.trim().toLowerCase();
  return US_STATES[v] ?? v;
}

export function buildMatcher(ids: number[], canonicalName: string, hqState: string | null): EntityMatcher {
  const phrase = coreName(canonicalName);
  const usable = phrase.split(" ").length >= 2 && distinctiveTokens(phrase).length > 0;
  return { ids: new Set(ids), phrase: usable ? phrase : null, hqState: normState(hqState) };
}

// deno-lint-ignore no-explicit-any
function entryId(e: any): number {
  const id = e?.crustdata_company_id ?? e?.company_id;
  return typeof id === "number" ? id : 0;
}

/** "id" for a linked match, "name" for an unlinked name match, null otherwise. */
// deno-lint-ignore no-explicit-any
export function matchEntry(m: EntityMatcher, e: any, personState?: string | null): "id" | "name" | null {
  const id = entryId(e);
  if (id > 0) return m.ids.has(id) ? "id" : null;
  if (!m.phrase) return null;
  const name = String(e?.name ?? e?.company_name ?? "");
  if (!containsPhrase(name, m.phrase)) return null;
  const ps = normState(personState);
  if (m.hqState && ps && ps !== m.hqState) return null;
  return "name";
}

