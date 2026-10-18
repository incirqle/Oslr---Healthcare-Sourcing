/**
 * talent-flow.ts: turns raw Crustdata v2 /person/search rows into the
 * company panel's hires and departures. Pure: no I/O, so every rule is
 * testable on its own (talent-flow.test.ts).
 *
 * Why this exists (2026-10-18 review, live-probed on Vanderbilt University
 * Medical Center, crustdata_company_id 1091931):
 *  - 13 of 50 "hires" were internal promotions (Assistant → Associate
 *    Professor). They also qualify as departures, so the same people showed
 *    up on both sides of the panel.
 *  - The previous employer was read from past[0], but v2 does not return
 *    `past` in date order (30 of 50 rows out of order) and past[0] was often
 *    the company itself. VUMC's top "hire source" was VUMC.
 *  - At an academic center about half of all departures are visiting
 *    students, interns, research assistants and volunteers.
 *  - The departure destination was current[0], which is often an old board
 *    seat or side role rather than the new job.
 */

import { type EntityMatcher, matchEntry } from "./matching.ts";
import { classifyRole, type RoleGroup } from "./roles.ts";

// deno-lint-ignore no-explicit-any
type Any = any;

/** Ids only (tests, callers without a name) or the full matcher (ids + the practice's written name). */
export type Target = Set<number> | EntityMatcher;

function targetPredicate(target: Target, person: Any): (e: Any) => boolean {
  if (target instanceof Set) {
    return (e: Any) => {
      const id = entryCompanyId(e);
      return id !== null && target.has(id);
    };
  }
  const state = person?.basic_profile?.location?.state ?? null;
  return (e: Any) => matchEntry(target, e, state) !== null;
}

export interface TalentFlowPerson {
  name: string;
  first_name: string | null;
  last_name: string | null;
  linkedin_profile_url: string | null;
  profile_picture_url: string | null;
  headline: string | null;
  current_title: string | null;
  current_company: string | null;
  current_company_linkedin_url: string | null;
  current_company_start_date: string | null;
  previous_company: string | null;
  previous_company_linkedin_url: string | null;
  previous_title: string | null;
  previous_end_date: string | null;
  function_category: string | null;
  seniority_level: string | null;
  /** Clinical role group of the role at the company (hire: new role; departure: role they left). */
  role_group: RoleGroup;
  specialty: string | null;
}

export type ExclusionReason =
  | "internal_move" // already worked there: promotion, re-title, or rehire within a year
  | "side_role" // a secondary role (board seat, adjunct) while the primary job is elsewhere
  | "non_employee" // student, intern, visiting, observer, volunteer, research assistant
  | "duplicate" // the same person twice in the response
  | "no_target_entry"; // the row does not actually show a qualifying entry at the company

export type ExclusionCounts = Record<ExclusionReason, number>;

export const emptyExclusions = (): ExclusionCounts => ({
  internal_move: 0,
  side_role: 0,
  non_employee: 0,
  duplicate: 0,
  no_target_entry: 0,
});

/**
 * Titles that are not employment. Residents and fellows are deliberately
 * NOT here: for clinical recruiting a resident leaving is a real signal.
 */
export const NON_EMPLOYEE_TITLE =
  /\b(students?|interns?|internship|externs?|externship|visiting|observer|observership|shadow(ing)?|volunteers?|undergraduate|ambassadors?|research assistants?|summer research|scholars? program|mentee|trainee program)\b/i;

/** A promotion or a quick return: a past entry at the company ending within this window of the new start. */
export const INTERNAL_MOVE_WINDOW_DAYS = 365;
/** A departure's destination must start no earlier than this many days before the exit. */
export const DESTINATION_OVERLAP_DAYS = 92;
/** Tolerance for "previous job ended before the new one started". */
export const HANDOFF_TOLERANCE_DAYS = 31;
/** A previous employer that ended longer ago than this is not where they came from (school, career break). */
export const PREVIOUS_JOB_MAX_GAP_DAYS = 730;

const DAY = 86_400_000;

function t(s: unknown): number {
  if (typeof s !== "string" || !s) return NaN;
  return Date.parse(s);
}

export function entryCompanyId(e: Any): number | null {
  const id = e?.crustdata_company_id ?? e?.company_id;
  return typeof id === "number" && id > 0 ? id : null;
}
export function entryName(e: Any): string | null {
  return e?.name ?? e?.company_name ?? e?.company ?? e?.employer_name ?? null;
}
export function entryTitle(e: Any): string | null {
  return e?.title ?? e?.employee_title ?? null;
}
/** v2 key observed live 2026-10-18 is company_professional_network_profile_url. */
export function entryLinkedIn(e: Any): string | null {
  return e?.company_professional_network_profile_url ??
    e?.company_professional_network_url ??
    e?.company_linkedin_profile_url ??
    e?.company_linkedin_url ??
    null;
}

function employment(person: Any): { current: Any[]; past: Any[] } {
  const emp = person?.experience?.employment_details ?? {};
  return {
    current: Array.isArray(emp.current) ? emp.current : [],
    past: Array.isArray(emp.past) ? emp.past : [],
  };
}

export function personKey(person: Any): string | null {
  const id = person?.crustdata_person_id;
  if (typeof id === "number" || (typeof id === "string" && id)) return `id:${id}`;
  const url = person?.social_handles?.professional_network_identifier?.profile_url;
  if (typeof url === "string" && url) return `url:${url.toLowerCase().replace(/\/+$/, "")}`;
  return null;
}

function baseFields(person: Any) {
  const bp = person?.basic_profile ?? {};
  return {
    name: bp.name ?? person?.name ?? "Unknown",
    first_name: bp.first_name ?? null,
    last_name: bp.last_name ?? null,
    linkedin_profile_url: person?.social_handles?.professional_network_identifier?.profile_url ??
      person?.linkedin_profile_url ?? null,
    profile_picture_url: bp.profile_picture_permalink ?? null,
    headline: bp.headline ?? null,
  };
}

const byDateDesc = (key: "start_date" | "end_date") => (a: Any, b: Any) =>
  (t(b?.[key]) || 0) - (t(a?.[key]) || 0);

export type Classified =
  | { keep: true; person: TalentFlowPerson }
  | { keep: false; reason: ExclusionReason };

/**
 * A HIRE: a current entry at the company that started on or after `sinceISO`,
 * for someone who was not already there.
 */
export function classifyHire(person: Any, target: Target, sinceISO: string): Classified {
  const since = t(sinceISO);
  const { current, past } = employment(person);
  const atTarget = targetPredicate(target, person);
  const targetCurrent = current.filter(atTarget);
  const recent = targetCurrent.filter((e) => t(e.start_date) >= since).sort(byDateDesc("start_date"));
  if (recent.length === 0) return { keep: false, reason: "no_target_entry" };

  // Earliest start among the recent target roles is the arrival date.
  const arrival = Math.min(...recent.map((e) => t(e.start_date)));
  // Already there: another current target role that started before the window.
  if (targetCurrent.some((e) => Number.isFinite(t(e.start_date)) && t(e.start_date) < since)) {
    return { keep: false, reason: "internal_move" };
  }
  // Promotion or quick return: a past target role that ended near the arrival.
  if (
    past.some((e) => atTarget(e) && Number.isFinite(t(e.end_date)) &&
      t(e.end_date) >= arrival - INTERNAL_MOVE_WINDOW_DAYS * DAY)
  ) {
    return { keep: false, reason: "internal_move" };
  }

  const roleEntry = recent.find((e) => e?.is_default === true) ?? recent[0];
  // Side role: the target entry is secondary and the primary job is elsewhere.
  const primaryElsewhere = current.some((e) => e?.is_default === true && !atTarget(e));
  if (roleEntry?.is_default !== true && primaryElsewhere) return { keep: false, reason: "side_role" };

  if (NON_EMPLOYEE_TITLE.test(entryTitle(roleEntry) ?? "")) return { keep: false, reason: "non_employee" };

  // Previous employer: the most recent non-target job that ended by the arrival.
  const previous = past
    .filter((e) =>
      !atTarget(e) && Number.isFinite(t(e.end_date)) &&
      t(e.end_date) <= arrival + HANDOFF_TOLERANCE_DAYS * DAY &&
      t(e.end_date) >= arrival - PREVIOUS_JOB_MAX_GAP_DAYS * DAY &&
      !NON_EMPLOYEE_TITLE.test(entryTitle(e) ?? "")
    )
    .sort(byDateDesc("end_date"))[0] ?? null;
  const role = classifyRole(entryTitle(roleEntry));

  return {
    keep: true,
    person: {
      ...baseFields(person),
      current_title: entryTitle(roleEntry),
      current_company: entryName(roleEntry),
      current_company_linkedin_url: entryLinkedIn(roleEntry),
      current_company_start_date: roleEntry?.start_date ?? null,
      previous_company: previous ? entryName(previous) : null,
      previous_company_linkedin_url: previous ? entryLinkedIn(previous) : null,
      previous_title: previous ? entryTitle(previous) : null,
      previous_end_date: previous?.end_date ?? null,
      function_category: roleEntry?.function_category ?? null,
      seniority_level: roleEntry?.seniority_level ?? null,
      role_group: role.group,
      specialty: role.specialty,
    },
  };
}

/**
 * A DEPARTURE: a past entry at the company that ended on or after
 * `sinceISO`, for someone with no current entry there.
 */
export function classifyDeparture(person: Any, target: Target, sinceISO: string): Classified {
  const since = t(sinceISO);
  const { current, past } = employment(person);
  const atTarget = targetPredicate(target, person);
  const exits = past.filter((e) => atTarget(e) && t(e.end_date) >= since).sort(byDateDesc("end_date"));
  if (exits.length === 0) return { keep: false, reason: "no_target_entry" };
  if (current.some(atTarget)) return { keep: false, reason: "internal_move" };

  // Every role they held there in the window was non-employment → not a departure.
  if (exits.every((e) => NON_EMPLOYEE_TITLE.test(entryTitle(e) ?? ""))) {
    return { keep: false, reason: "non_employee" };
  }
  const exit = exits.find((e) => !NON_EMPLOYEE_TITLE.test(entryTitle(e) ?? "")) ?? exits[0];
  const exitT = t(exit.end_date);

  // Destination: a current role that began around or after the exit.
  // Primary (is_default) first, then the latest start.
  const candidates = current.filter((e) =>
    !atTarget(e) && Number.isFinite(t(e.start_date)) && t(e.start_date) >= exitT - DESTINATION_OVERLAP_DAYS * DAY
  );
  const dest = candidates.find((e) => e?.is_default === true) ??
    candidates.sort(byDateDesc("start_date"))[0] ?? null;
  const role = classifyRole(entryTitle(exit));

  return {
    keep: true,
    person: {
      ...baseFields(person),
      current_title: dest ? entryTitle(dest) : null,
      current_company: dest ? entryName(dest) : null,
      current_company_linkedin_url: dest ? entryLinkedIn(dest) : null,
      current_company_start_date: dest?.start_date ?? null,
      previous_company: entryName(exit),
      previous_company_linkedin_url: entryLinkedIn(exit),
      previous_title: entryTitle(exit),
      previous_end_date: exit.end_date ?? null,
      function_category: exit?.function_category ?? null,
      seniority_level: exit?.seniority_level ?? null,
      role_group: role.group,
      specialty: role.specialty,
    },
  };
}

export interface ClassifiedList {
  people: TalentFlowPerson[];
  excluded: ExclusionCounts;
}

/** Classify, dedupe and date-sort one direction. */
export function classifyAll(
  rows: Any[],
  target: Target,
  sinceISO: string,
  direction: "hires" | "departures",
): ClassifiedList {
  const excluded = emptyExclusions();
  const seen = new Set<string>();
  const people: TalentFlowPerson[] = [];
  for (const row of rows ?? []) {
    const key = personKey(row);
    if (key && seen.has(key)) {
      excluded.duplicate++;
      continue;
    }
    if (key) seen.add(key);
    const c = direction === "hires"
      ? classifyHire(row, target, sinceISO)
      : classifyDeparture(row, target, sinceISO);
    if (c.keep) people.push(c.person);
    else excluded[c.reason]++;
  }
  const dateKey = direction === "hires" ? "current_company_start_date" : "previous_end_date";
  people.sort((a, b) => (t(b[dateKey]) || 0) - (t(a[dateKey]) || 0));
  return { people, excluded };
}

export interface FlowCount {
  company: string;
  count: number;
  linkedin_url: string | null;
}

/** Top sources (hires) or destinations (departures), names normalized for counting. */
export function topCompanies(
  people: TalentFlowPerson[],
  field: "previous_company" | "current_company",
  limit = 10,
): FlowCount[] {
  const linkField = field === "previous_company" ? "previous_company_linkedin_url" : "current_company_linkedin_url";
  const m = new Map<string, FlowCount>();
  for (const p of people) {
    const name = p[field];
    if (!name || !name.trim()) continue;
    const k = name.trim().toLowerCase();
    const ex = m.get(k) ?? { company: name.trim(), count: 0, linkedin_url: p[linkField] ?? null };
    ex.count++;
    if (!ex.linkedin_url) ex.linkedin_url = p[linkField] ?? null;
    m.set(k, ex);
  }
  return [...m.values()].sort((a, b) => b.count - a.count).slice(0, limit);
}
