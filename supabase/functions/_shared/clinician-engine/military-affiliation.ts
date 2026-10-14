/**
 * military-affiliation.ts — who is actually in uniform (2026-10-14).
 *
 * Learned on the Balboa and Colorado probes:
 *   - Military physicians tag the SERVICE ("US Army", "US Navy", "USN",
 *     "United States Air Force") far more often than the hospital.
 *   - A civilian surgeon with a part-time commission lists the practice
 *     first and "US Army" second, usually WITHOUT the word "reserve". Of 80
 *     orthopedic surgeons tagged to an active component, 21% were this.
 *   - Explicit Guard / Reserve tags ("U.S. Navy Reserve", "Michigan Army
 *     National Guard", "Major, USAR") exist but are the minority.
 *   - Crustdata carries a run of thin, fabricated-looking "Orthopaedic
 *     Surgeon at US Army" profiles: no location, one employer, no history,
 *     no summary, a headline that only restates the title. About 12% of
 *     the same sample.
 *   - Military clinicians rotate every 2-4 years and many never update
 *     their location, so a facility-tagged profile in another state is a
 *     transfer signal, not noise.
 *
 * This module is pure (no I/O): it reads a result row the way a recruiter
 * would and annotates it; the handler decides what to set aside based on
 * which employer group the query asked for.
 */

import type { EmployerGroupValue, SearchCriteria } from "./clinician-criteria.ts";
import { containsWholePhrase } from "./clinical-vocabulary.ts";

export type MilitaryAffiliation = "active" | "reserve" | "likely_reserve" | "veteran";

export interface MilitaryRead {
  affiliation: MilitaryAffiliation | null;
  /** Short, recruiter-readable evidence ("civilian primary: OrthoArizona; also US Army Reserves"). */
  evidence: string;
}

interface EmployerLike {
  name?: unknown;
  title?: unknown;
  company_domain?: unknown;
  company_website_domain?: unknown;
  is_primary?: unknown;
  end_date?: unknown;
}

interface RowLike {
  headline?: unknown;
  summary?: unknown;
  job_title?: unknown;
  job_company_name?: unknown;
  location_locality?: unknown;
  location_region?: unknown;
  location_city?: unknown;
  location_state?: unknown;
  current_employers?: unknown;
  experience_history?: unknown;
  past_employers?: unknown;
  education?: unknown;
  education_background?: unknown;
  facility_recall?: unknown;
}

function s(v: unknown): string {
  return typeof v === "string" ? v : "";
}

/** Active-component employer names and domains. Whole-phrase matches. */
const ACTIVE_NAME_PHRASES = [
  "us army", "u.s. army", "united states army", "us navy", "u.s. navy", "united states navy", "usn",
  "us air force", "u.s. air force", "united states air force", "usaf", "united states marine corps", "us marine corps",
  "defense health agency", "defense health network", "military health system", "department of defense",
  "army medical center", "army community hospital", "army hospital", "naval medical center", "naval hospital",
  "naval health clinic", "navy medicine", "army medicine", "army medical corps", "navy medical corps",
  "air force medical", "uniformed services", "military medical center", "military hospital",
  "walter reed", "landstuhl", "fort belvoir community hospital", "nmcsd", "tripler", "madigan", "womack",
  "brooke army", "evans army", "darnall", "eisenhower army", "keesler medical center", "david grant medical center",
  "wright-patterson medical center", "wright patterson medical center", "medical group usaf", "medical group-usaf",
];
const ACTIVE_DOMAINS = ["army.mil", "navy.mil", "af.mil", "airforce.com", "marines.mil", "dha.mil", "health.mil", "tricare.mil", "usuhs.edu"];
const AF_MEDICAL_GROUP = /\b\d{1,3}(st|nd|rd|th|d)\s+(special operations\s+)?medical (group|wing)\b/i;

/** Guard / Reserve tags, on the employer name OR the title. */
const RESERVE_PHRASES = [
  "army reserve", "army reserves", "navy reserve", "navy reserves", "air force reserve", "air force reserves",
  "army national guard", "air national guard", "usar", "usnr", "afrc", "reserve component", "reservist",
  "guard and reserve",
];
const RESERVE_TITLE = /\b(reservist|reserves?\b|national guard|usar|usnr)\b/i;

/** Foreign forces that share our words. Never military for this product. */
const FOREIGN_PHRASES = [
  "ministry of national guard", "national guard health affairs", "australian army", "australian defence",
  "royal navy", "royal air force", "british army", "canadian armed forces", "canadian forces", "indian army",
  "indian navy", "indian air force", "pakistan army", "pakistan air force", "israel defense forces", "idf",
  "saudi arabian", "royal saudi", "bundeswehr", "french army", "german army", "nigerian army", "egyptian army",
  "singapore armed forces", "korean army", "turkish armed forces", "philippine army", "south african",
];

/** Civilian care-delivery employer? A loose read: hospital / practice / health words. */
const CLINICAL_EMPLOYER = /(hospital|health|medical|clinic|orthop|surg|physician|pllc|associates|institute|practice|medicine|center|centre|group|care\b|\bmd\b|\bpa\b|\bllc\b)/i;
/** Societies, journals, boards, schools of personal projects — not an employer that signs a paycheck. */
const NON_EMPLOYER = /\b(society|association|journal|board of|foundation|committee|academy of|college of surgeons|fellows?|alumni|crossfit|llc\s*$)\b/i;

function isForeign(name: string): boolean {
  const n = name.toLowerCase();
  return FOREIGN_PHRASES.some((p) => containsWholePhrase(n, p));
}

export function isActiveMilitaryEmployer(name: string, domain?: string): boolean {
  const n = (name ?? "").toLowerCase();
  if (!n && !domain) return false;
  if (n && isForeign(n)) return false;
  if (n && (ACTIVE_NAME_PHRASES.some((p) => containsWholePhrase(n, p)) || AF_MEDICAL_GROUP.test(n))) return true;
  const d = (domain ?? "").toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
  return !!d && ACTIVE_DOMAINS.some((ad) => d === ad || d.endsWith("." + ad));
}

export function isReserveEmployer(name: string, title?: string): boolean {
  const n = (name ?? "").toLowerCase();
  if (n && isForeign(n)) return false;
  if (n && RESERVE_PHRASES.some((p) => containsWholePhrase(n, p))) return true;
  const t = title ?? "";
  return !!t && RESERVE_TITLE.test(t) && !/\breserved\b/i.test(t);
}

function employerDomain(e: EmployerLike): string {
  return s(e.company_domain) || s(e.company_website_domain);
}

/**
 * Read one row.
 *   reserve         explicit Guard / Reserve tag on a current employer or title
 *   active          the primary current employer is military and no other
 *                   current employer is a civilian care-delivery employer
 *   likely_reserve  a military current employer sits beside a civilian
 *                   care-delivery employer (or the primary is civilian)
 *   veteran         military only in past roles
 *   null            no military tie anywhere
 */
export function readMilitaryAffiliation(row: RowLike): MilitaryRead {
  const current = Array.isArray(row.current_employers) ? (row.current_employers as EmployerLike[]) : [];
  const mil: EmployerLike[] = [];
  const civilianClinical: EmployerLike[] = [];
  let reserveEvidence: string | null = null;

  for (const e of current) {
    const name = s(e.name);
    const title = s(e.title);
    if (isReserveEmployer(name, title)) {
      reserveEvidence = name || title;
      continue;
    }
    if (isActiveMilitaryEmployer(name, employerDomain(e))) {
      mil.push(e);
      continue;
    }
    if (name && !NON_EMPLOYER.test(name) && CLINICAL_EMPLOYER.test(name)) civilianClinical.push(e);
  }

  if (reserveEvidence) {
    const civ = civilianClinical[0] ? `; civilian: ${s(civilianClinical[0].name)}` : "";
    return { affiliation: "reserve", evidence: `tag: ${reserveEvidence}${civ}`.slice(0, 160) };
  }

  if (mil.length > 0) {
    const primary = current.find((e) => e.is_primary === true) ?? current[0];
    const primaryIsMilitary = !!primary && mil.includes(primary);
    if (civilianClinical.length === 0) {
      return { affiliation: "active", evidence: `current: ${s(mil[0].name)}`.slice(0, 160) };
    }
    const civ = s(civilianClinical[0].name);
    if (!primaryIsMilitary) {
      return { affiliation: "likely_reserve", evidence: `civilian primary: ${civ}; also ${s(mil[0].name)}`.slice(0, 160) };
    }
    return { affiliation: "likely_reserve", evidence: `${s(mil[0].name)} alongside civilian ${civ}`.slice(0, 160) };
  }

  const history = Array.isArray(row.experience_history)
    ? (row.experience_history as EmployerLike[])
    : Array.isArray(row.past_employers) ? (row.past_employers as EmployerLike[]) : [];
  const pastMil = history.find((e) => e.is_primary !== true && isActiveMilitaryEmployer(s(e.name), employerDomain(e)) && !current.includes(e));
  if (pastMil) return { affiliation: "veteran", evidence: `past: ${s(pastMil.name)}`.slice(0, 160) };

  return { affiliation: null, evidence: "" };
}

/**
 * The junk pattern from the 2026-10-14 sample: "Orthopaedic Surgeon at US
 * Army", no city or state, exactly one current employer, no history, no
 * summary, no education. Real people almost always carry at least one of
 * those. Applied only when the query asked for a military employer.
 */
export function isThinProfile(row: RowLike): { thin: boolean; reason: string } {
  const city = s(row.location_locality) || s(row.location_city);
  const state = s(row.location_region) || s(row.location_state);
  const current = Array.isArray(row.current_employers) ? row.current_employers : [];
  const history = Array.isArray(row.experience_history) ? row.experience_history : Array.isArray(row.past_employers) ? row.past_employers : [];
  const education = Array.isArray(row.education) ? row.education : Array.isArray(row.education_background) ? row.education_background : [];
  const summary = s(row.summary).trim();
  const headline = s(row.headline).trim().toLowerCase();
  const title = s(row.job_title).trim().toLowerCase();
  const company = s(row.job_company_name).trim().toLowerCase();
  const headlineRestatesTitle = !headline ||
    headline === title ||
    headline === `${title} at ${company}` ||
    headline === `${title} @ ${company}` ||
    headline === `${title}, ${company}`;

  const missing: string[] = [];
  if (!city && !state) missing.push("no location");
  if (current.length <= 1 && history.length <= 1) missing.push("no history");
  if (!summary) missing.push("no summary");
  if (education.length === 0) missing.push("no education");
  if (headlineRestatesTitle) missing.push("headline only restates the title");

  // Every signal missing at once is the fabricated shape. Any one present is a person.
  const thin = missing.length === 5;
  return { thin, reason: thin ? `Thin profile: ${missing.join(", ")}` : "" };
}

export interface MilitarySplit<R> {
  kept: R[];
  /** Guard / Reserve (or likely so) set aside from an active-duty ask, and the reverse. */
  reserve: R[];
  /** Fabricated-looking rows set aside from a military ask. */
  thin: R[];
}

function askedMilitaryGroup(criteria: SearchCriteria[]): "dod" | "guard_reserve" | null {
  for (const c of criteria) {
    if (c.kind !== "employer_group" || c.enforcement === "dropped") continue;
    const key = (c.value as EmployerGroupValue).group_key;
    if (key === "dod") return "dod";
    if (key === "guard_reserve") return "guard_reserve";
  }
  return null;
}

/**
 * Annotate every row with its military read. When the query asked for the
 * DoD group, Guard / Reserve and likely-Reserve rows are set aside with the
 * evidence (they are a different population: civilian surgeons with a
 * commission). When it asked for Guard and Reserve, active-only rows are set
 * aside. Thin profiles are set aside under either military ask.
 */
export function applyMilitaryAffiliation<R extends RowLike & Record<string, unknown>>(
  rows: R[],
  criteria: SearchCriteria[],
): MilitarySplit<R> {
  const asked = askedMilitaryGroup(criteria);
  const kept: R[] = [];
  const reserve: R[] = [];
  const thin: R[] = [];
  for (const row of rows) {
    const read = readMilitaryAffiliation(row);
    const annotated = row as Record<string, unknown>;
    annotated.military_affiliation = read.affiliation;
    annotated.military_evidence = read.evidence || null;
    if (!asked) {
      kept.push(row);
      continue;
    }
    const t = isThinProfile(row);
    if (t.thin) {
      annotated.audit_verdict = "reject";
      annotated.audit_score = 0;
      annotated.audit_reason = t.reason + ".";
      annotated.audit_evidence = s(row.job_company_name).slice(0, 140) || null;
      annotated.thin_profile = true;
      thin.push(row);
      continue;
    }
    if (asked === "dod" && (read.affiliation === "reserve" || read.affiliation === "likely_reserve")) {
      annotated.audit_verdict = "reject";
      annotated.audit_score = 0;
      annotated.audit_reason = read.affiliation === "reserve"
        ? `Guard or Reserve, not active duty: ${read.evidence}.`
        : `Likely Guard or Reserve (civilian employer alongside the service): ${read.evidence}.`;
      annotated.audit_evidence = s(row.job_company_name).slice(0, 140) || null;
      annotated.military_filtered = true;
      reserve.push(row);
      continue;
    }
    if (asked === "guard_reserve" && read.affiliation === "active") {
      annotated.audit_verdict = "reject";
      annotated.audit_score = 0;
      annotated.audit_reason = `Active duty, not Guard or Reserve: ${read.evidence}.`;
      annotated.audit_evidence = s(row.job_company_name).slice(0, 140) || null;
      annotated.military_filtered = true;
      reserve.push(row);
      continue;
    }
    kept.push(row);
  }
  return { kept, reserve, thin };
}

/**
 * Facility-recall rows (pulled without the location clip) that list another
 * state get a note instead of a rejection: the Balboa probe showed these are
 * transfers or stale duty stations, which a recruiter wants to see flagged.
 */
export function annotateFacilityLocation<R extends RowLike & Record<string, unknown>>(
  rows: R[],
  criteria: SearchCriteria[],
): void {
  const loc = criteria.find((c) => c.kind === "location" && c.enforcement !== "dropped");
  const v = (loc?.value ?? {}) as { state?: string; city?: string };
  const askedState = (v.state ?? "").toLowerCase();
  const askedCity = (v.city ?? "").toLowerCase();
  for (const row of rows) {
    if (row.facility_recall !== true) continue;
    const state = (s(row.location_region) || s(row.location_state)).toLowerCase();
    const city = (s(row.location_locality) || s(row.location_city)).toLowerCase();
    const annotated = row as Record<string, unknown>;
    if (!state && !city) {
      annotated.location_note = "No location on the profile; found through the facility record.";
    } else if (askedState && state && state !== askedState) {
      annotated.location_note = `Lists ${city ? city + ", " : ""}${state}; facility-tagged, likely transferred or stale.`;
    } else if (askedCity && city && city !== askedCity) {
      annotated.location_note = `Lists ${city}; found through the facility record.`;
    }
  }
}
