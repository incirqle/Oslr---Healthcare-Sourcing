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
