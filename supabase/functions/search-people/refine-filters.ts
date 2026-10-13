/**
 * refine-filters.ts — apply the search page's "Edit Search Criteria" edits
 * onto the cached parsed payload the engine maps.
 *
 * Before 2026-10-12 the adapter honoured four of the editor's seven fields:
 * location and experience edits were dropped on the client, the role class
 * was not shown at all, and removing a specialty chip did nothing because
 * the keyword expansions of the same word ("orthopedic", "orthopaedic")
 * were merged back into the same criterion on the server. Every field the
 * editor shows now lands on the parse, and keyword chips that only echo a
 * specialty's spelling are dropped.
 *
 * Pure: no I/O, no Deno — unit-testable under any runtime.
 */

type Row = Record<string, unknown>;

export interface EditorFilters {
  job_titles?: string[] | null;
  specialties?: string[] | null;
  keywords?: string[] | null;
  companies?: string[] | null;
  locations?: string[] | null;
  experience_years?: number | null;
  role_class?: string | null;
}

/* ------------------------------------------------------------------ */
/*  Locations                                                          */
/* ------------------------------------------------------------------ */

export const US_STATES: Record<string, string> = {
  al: "alabama", ak: "alaska", az: "arizona", ar: "arkansas", ca: "california",
  co: "colorado", ct: "connecticut", de: "delaware", fl: "florida", ga: "georgia",
  hi: "hawaii", id: "idaho", il: "illinois", in: "indiana", ia: "iowa", ks: "kansas",
  ky: "kentucky", la: "louisiana", me: "maine", md: "maryland", ma: "massachusetts",
  mi: "michigan", mn: "minnesota", ms: "mississippi", mo: "missouri", mt: "montana",
  ne: "nebraska", nv: "nevada", nh: "new hampshire", nj: "new jersey", nm: "new mexico",
  ny: "new york", nc: "north carolina", nd: "north dakota", oh: "ohio", ok: "oklahoma",
  or: "oregon", pa: "pennsylvania", ri: "rhode island", sc: "south carolina",
  sd: "south dakota", tn: "tennessee", tx: "texas", ut: "utah", vt: "vermont",
  va: "virginia", wa: "washington", wv: "west virginia", wi: "wisconsin", wy: "wyoming",
  dc: "district of columbia",
};
const STATE_NAMES = new Set(Object.values(US_STATES));

export interface ParsedLocationEdit {
  city: string | null;
  state: string | null;
}

/**
 * "Miami, Florida" / "miami florida" / "Miami, FL" / "Florida" / "Dallas"
 * → {city, state}. A trailing state name or abbreviation is the state; the
 * rest is the city. A bare state name is state-only; anything else is a
 * state-less city (the engine matches those on full location + radius).
 */
export function parseLocationEdit(raw: string): ParsedLocationEdit | null {
  const text = raw.toLowerCase().replace(/[.,]/g, " ").replace(/\s+/g, " ").trim();
  if (!text) return null;
  if (STATE_NAMES.has(text)) return { city: null, state: text };
  if (US_STATES[text]) return { city: null, state: US_STATES[text] };
  // Longest state-name suffix first ("new york", "north carolina").
  for (const name of [...STATE_NAMES].sort((a, b) => b.length - a.length)) {
    if (text.endsWith(` ${name}`)) {
      const city = text.slice(0, -name.length).trim();
      return { city: city || null, state: name };
    }
  }
  const parts = text.split(" ");
  const last = parts[parts.length - 1];
  if (parts.length > 1 && US_STATES[last]) {
    return { city: parts.slice(0, -1).join(" "), state: US_STATES[last] };
  }
  return { city: text, state: null };
}

/** The editor's string form of the parse's location, as SearchPage builds it. */
export function locationLabelsFromParsed(parsed: Row): string[] {
  const out: string[] = [];
  const loc = (parsed.location ?? {}) as Row;
  const city = typeof loc.city === "string" ? loc.city : "";
  const state = typeof loc.state === "string" ? loc.state : "";
  if (city && state) out.push(`${city} ${state}`);
  else if (state) out.push(state);
  else if (city) out.push(city);
  if (Array.isArray(parsed.locations)) {
    for (const entry of parsed.locations as Row[]) {
      const c = typeof entry?.city === "string" ? entry.city : "";
      const s = typeof entry?.state === "string" ? entry.state : "";
      if (c && s) out.push(`${c} ${s}`);
      else if (s) out.push(s);
      else if (c) out.push(c);
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/*  Keyword echoes of a specialty                                       */
/* ------------------------------------------------------------------ */

/** Spelling-insensitive key: "Orthopaedics" ≡ "orthopedic" ≡ "ortho pedic". */
export function variantKey(term: string): string {
  return term.toLowerCase()
    .replace(/ae/g, "e")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/ies$/, "y")
    .replace(/s$/, "");
}

/** True when the keyword is just another spelling of one of the specialties. */
export function keywordEchoesSpecialty(keyword: string, specialties: readonly string[]): boolean {
  const k = variantKey(keyword);
  if (!k) return false;
  return specialties.some((sp) => {
    const s = variantKey(sp);
    return s === k || s.split(" ").includes(k);
  });
}

export function dropSpecialtyEchoes(keywords: readonly string[], specialties: readonly string[]): string[] {
  return keywords.filter((k) => !keywordEchoesSpecialty(k, specialties));
}

/* ------------------------------------------------------------------ */
/*  Apply                                                              */
/* ------------------------------------------------------------------ */

const arr = (v: unknown): string[] | null =>
  Array.isArray(v) ? (v as unknown[]).filter((x): x is string => typeof x === "string") : null;
const same = (a: string[] | null, b: string[]): boolean =>
  !!a && a.length === b.length && a.every((x, i) => x === b[i]);
const edited = (sent: string[] | null, derived: string[]): sent is string[] =>
  sent !== null && !same(sent, derived);

/**
 * Overlay the editor's current values onto the cached parse. Values that
 * equal their derivation from the parse are left alone (so criterion ids
 * stay positionally stable); every genuine edit replaces the parse field
 * the engine maps. Returns a NEW object.
 */
export function applyEditorFilters(parsedIn: Row, filters: EditorFilters | null): Row {
  const parsed: Row = { ...parsedIn };
  if (!filters) return parsed;

  const dJobTitles = arr(parsed.job_titles) ?? [];
  const dSpecialties = arr(parsed.specialties) ??
    (typeof parsed.specialty === "string" && parsed.specialty ? [parsed.specialty] : []);
  const dKeywordsRaw = arr(parsed.required_keywords) ?? arr(parsed.keywords) ?? [];
  const dCompanies = arr(parsed.current_companies) ?? arr(parsed.companies) ?? [];
  const dLocations = locationLabelsFromParsed(parsed);

  const fJobTitles = arr(filters.job_titles);
  const fSpecialties = arr(filters.specialties);
  const fKeywords = arr(filters.keywords);
  const fCompanies = arr(filters.companies);
  const fLocations = arr(filters.locations);

  if (edited(fJobTitles, dJobTitles)) parsed.job_titles = fJobTitles;

  let specialties = dSpecialties;
  if (edited(fSpecialties, dSpecialties)) {
    specialties = fSpecialties;
    parsed.specialties = fSpecialties;
    parsed.specialty = fSpecialties[0] ?? null;
  }

  // Keyword chips: the page shows keywords WITHOUT specialty echoes, so a
  // "no change" edit arrives as the echo-free list. Compare against the
  // echo-free derivation, and always strip echoes of the CURRENT
  // specialties so a removed specialty cannot survive as a keyword.
  const dKeywords = dropSpecialtyEchoes(dKeywordsRaw, dSpecialties);
  const keywords = edited(fKeywords, dKeywords) ? fKeywords : dKeywordsRaw;
  const cleanedKeywords = dropSpecialtyEchoes(keywords, specialties);
  if (!same(cleanedKeywords, dKeywordsRaw)) {
    parsed.required_keywords = cleanedKeywords;
    parsed.keywords = cleanedKeywords;
  }

  if (edited(fCompanies, dCompanies)) {
    parsed.current_companies = fCompanies;
    parsed.companies = fCompanies;
  }

  if (edited(fLocations, dLocations)) {
    const parsedLocs = fLocations.map(parseLocationEdit).filter((l): l is ParsedLocationEdit => !!l);
    const [first, ...rest] = parsedLocs;
    const prior = (parsed.location ?? {}) as Row;
    parsed.location = first
      ? {
        ...prior,
        city: first.city,
        state: first.state,
        metro: null,
        region_key: null,
        city_confidence: first.city ? 1 : 0,
        state_confidence: first.state ? 1 : 0,
      }
      : { city: null, state: null, metro: null, region_key: null, city_confidence: 0, state_confidence: 0 };
    parsed.locations = rest.map((l) => ({
      ...(l.state ? { state: l.state } : {}),
      ...(l.city ? { city: l.city } : {}),
    }));
    parsed.preferred_city = null;
  }

  if (filters.experience_years !== undefined) {
    const years = typeof filters.experience_years === "number" && filters.experience_years > 0
      ? Math.floor(filters.experience_years)
      : null;
    const derived = typeof parsed.min_years_experience === "number" ? parsed.min_years_experience : null;
    if (years !== derived) parsed.min_years_experience = years;
  }

  if (filters.role_class !== undefined) {
    const cls = typeof filters.role_class === "string" && filters.role_class.trim()
      ? filters.role_class.trim().toLowerCase()
      : null;
    const derived = typeof parsed.role_class === "string" && parsed.role_class ? parsed.role_class : null;
    if (cls !== derived) {
      parsed.role_class = cls;
      parsed.role_classes = [];
    }
  }

  return parsed;
}
