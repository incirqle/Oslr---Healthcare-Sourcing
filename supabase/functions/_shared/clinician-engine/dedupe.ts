/**
 * dedupe.ts — one person, one row.
 *
 * Rows reach the pool from three provider calls (lexical pages, semantic
 * recall, company-graph recall) and from the cache. Each merge point
 * de-duplicates on a key, but the key was a raw string compare: the same
 * person under "https://www.linkedin.com/in/jane/" and
 * "linkedin.com/in/jane", or under two Crustdata profiles with no URL, got
 * through as two rows (2026-10-13: the same surgeon three times on page one).
 *
 * This module is the single key for every merge AND a final pass over the
 * pool. Pure: no I/O.
 */

export interface KeyedRow {
  linkedin_url?: unknown;
  linkedin_profile_url?: unknown;
  id?: unknown;
  crustdata_person_id?: unknown;
  person_id?: unknown;
  full_name?: unknown;
  name?: unknown;
  job_company_name?: unknown;
  current_employers?: unknown;
}

function s(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/** linkedin.com/in/jane-doe-123 — scheme, host, trailing slash, query and case removed. */
export function normalizeLinkedInUrl(raw: unknown): string {
  const u = s(raw).toLowerCase();
  if (!u) return "";
  return u
    .replace(/^https?:\/\//, "")
    .replace(/^(www|[a-z]{2})\./, "")
    .replace(/[?#].*$/, "")
    .replace(/\/+$/, "");
}

/** Honorifics and credential letters people append to their own names. */
const NAME_NOISE = new Set([
  "dr", "mr", "mrs", "ms", "prof", "professor",
  "md", "do", "mbbs", "dds", "dmd", "dpm", "od", "pharmd", "dpt", "dnp", "phd", "mph", "mba", "msc", "ms", "ma",
  "pa", "pac", "pa-c", "np", "rn", "bsn", "msn", "crna", "aprn", "fnp", "cnm",
  "facs", "faaos", "facc", "fase", "faap", "facp", "facog", "facep", "frcs", "frcsc", "mrcs",
  "jr", "sr", "ii", "iii", "iv", "esq",
]);
/** Entity suffixes on practice names. */
const EMPLOYER_NOISE = new Set([
  "pa", "p.a", "pllc", "llc", "llp", "inc", "incorporated", "corp", "corporation", "ltd", "co", "the", "of", "and", "&",
]);

/** Lower-case letters/digits, with noise tokens removed: "Dr. Jen Peter-Holman, MD" → "jenpeterholman". */
function squash(v: unknown, noise: ReadonlySet<string>): string {
  return s(v).toLowerCase()
    .split(/[^a-z0-9.&-]+/)
    .map((t) => t.replace(/\.+$/g, "").replace(/\./g, ""))
    .filter((t) => t && !noise.has(t))
    .join("")
    .replace(/[^a-z0-9]+/g, "");
}

function primaryEmployerName(row: KeyedRow): string {
  const list = Array.isArray(row.current_employers) ? row.current_employers as Array<Record<string, unknown>> : [];
  const primary = list.find((e) => e && e.is_primary === true) ?? list.find((e) => e && e.is_default === true) ?? list[0];
  const name = primary ? (primary.name ?? primary.company ?? primary.company_name) : null;
  return s(name) || s(row.job_company_name);
}

/**
 * Every identity a row carries, strongest first. Two rows are the same
 * person when ANY identity matches: URL, provider id, or name + primary
 * employer (the only handle a URL-less duplicate profile has).
 */
export function identityKeys(row: KeyedRow): string[] {
  const keys: string[] = [];
  const url = normalizeLinkedInUrl(row.linkedin_url ?? row.linkedin_profile_url);
  if (url) keys.push(`li:${url}`);
  const id = row.id ?? row.crustdata_person_id ?? row.person_id;
  if ((typeof id === "string" && id.trim() && !/^https?:/.test(id)) || typeof id === "number") keys.push(`id:${String(id).trim()}`);
  const name = squash(row.full_name ?? row.name, NAME_NOISE);
  if (name) {
    const employer = squash(primaryEmployerName(row), EMPLOYER_NOISE);
    keys.push(`nc:${name}|${employer}`);
  }
  return keys;
}

/** The single key merge points use (first identity). Null when the row has none. */
export function rowIdentity(row: KeyedRow): string | null {
  return identityKeys(row)[0] ?? null;
}

/**
 * Collapse duplicates, keeping the FIRST occurrence (lexical before recall,
 * higher-ranked before lower). Returns the survivors and how many fell.
 */
export function dedupeRows<R extends KeyedRow>(rows: R[]): { rows: R[]; removed: number } {
  const seen = new Set<string>();
  const out: R[] = [];
  let removed = 0;
  for (const row of rows) {
    const keys = identityKeys(row);
    if (keys.length === 0) {
      out.push(row);
      continue;
    }
    if (keys.some((k) => seen.has(k))) {
      removed++;
      continue;
    }
    for (const k of keys) seen.add(k);
    out.push(row);
  }
  return { rows: out, removed };
}

/* ------------------------------------------------------------------ */
/*  Same person, two profiles (2026-10-13)                             */
/* ------------------------------------------------------------------ */

/**
 * "J. Pieter Hommen — Co-Founder, OrthoMiami" and "Jan Pieter Hommen —
 * Orthopedic Surgeon, Hommen Orthopedic Institute" are one surgeon with two
 * Crustdata profiles: different URL, id, name spelling AND employer, so no
 * exact identity can join them. This is a NAME-SHAPE rule: same surname,
 * compatible first name (equal, or one is the other's initial), equal
 * middle names when both carry one, and the same city. The later row is
 * not dropped — it is set aside with the reason, so a wrong merge is
 * visible and reversible.
 */
export interface PersonName {
  first: string;
  middle: string;
  last: string;
}

export function parsePersonName(raw: unknown): PersonName | null {
  const cleaned = s(raw).toLowerCase()
    .replace(/[,(].*$/, "") // ", MD" / "(he/him)"
    .replace(/[^a-z\s.'-]/g, " ")
    .split(/\s+/)
    .map((t) => t.replace(/\.+$/, ""))
    .filter((t) => t && !NAME_NOISE.has(t));
  if (cleaned.length < 2) return null;
  const last = cleaned[cleaned.length - 1].replace(/-/g, "");
  const first = cleaned[0];
  const middle = cleaned.length > 2 ? cleaned.slice(1, -1).join(" ") : "";
  return { first, middle, last };
}

function compatibleFirst(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length === 1 && b.startsWith(a)) return true;
  if (b.length === 1 && a.startsWith(b)) return true;
  return false;
}

function compatibleMiddle(a: string, b: string): boolean {
  if (!a || !b) return true;
  if (a === b) return true;
  const ai = a.split(" ")[0], bi = b.split(" ")[0];
  if (ai.length === 1 && bi.startsWith(ai)) return true;
  if (bi.length === 1 && ai.startsWith(bi)) return true;
  return false;
}

function city(row: Record<string, unknown>): string {
  return squash(row.location_locality ?? row.location_city, new Set()).toLowerCase();
}

/** True when the two rows read as the same person under the name-shape rule. */
export function samePersonByName(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  const na = parsePersonName(a.full_name ?? a.name);
  const nb = parsePersonName(b.full_name ?? b.name);
  if (!na || !nb) return false;
  if (na.last !== nb.last || na.last.length < 3) return false;
  if (!compatibleFirst(na.first, nb.first)) return false;
  if (!compatibleMiddle(na.middle, nb.middle)) return false;
  // Two "John Smith"s with no middle name need more than a surname: the
  // same city AND a shared first name in full (an initial is not enough).
  const strong = na.middle && nb.middle && na.middle === nb.middle;
  if (!strong && (na.first.length === 1 || nb.first.length === 1)) return false;
  const ca = city(a), cb = city(b);
  if (!ca || !cb || ca !== cb) return false;
  return true;
}

export interface SuspectSplit<R> {
  rows: R[];
  suspects: R[];
}

/**
 * Set aside later rows that read as a second profile of an earlier row.
 * Annotated like grader rejects, naming the row they duplicate.
 */
export function setAsideSuspectedDuplicates<R extends Record<string, unknown>>(rows: R[]): SuspectSplit<R> {
  const kept: R[] = [];
  const suspects: R[] = [];
  for (const row of rows) {
    const twin = kept.find((k) => samePersonByName(k, row));
    if (!twin) {
      kept.push(row);
      continue;
    }
    const twinName = s(twin.full_name ?? twin.name) || "an earlier result";
    const twinEmployer = s(twin.job_company_name);
    const annotated = row as Record<string, unknown>;
    annotated.audit_verdict = "reject";
    annotated.audit_score = 0;
    annotated.audit_reason = `Likely a second profile of ${twinName}${twinEmployer ? ` (${twinEmployer})` : ""}, already shown.`;
    annotated.audit_evidence = s(row.full_name ?? row.name).slice(0, 140) || null;
    annotated.duplicate_of = twin.id ?? twin.linkedin_url ?? twinName;
    suspects.push(row);
  }
  return { rows: kept, suspects };
}
