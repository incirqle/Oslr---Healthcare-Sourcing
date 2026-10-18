/**
 * roster.ts: everyone currently at a practice, one row per person, with the
 * clinical role group, specialty, where they trained, and the noise removed.
 * Pure: no I/O (roster.test.ts).
 *
 * Why: a private practice is small enough to show every person, and that
 * is what a recruiter wants to see. Live 2026-10-18, Dallas Plastic Surgery
 * Institute: the LinkedIn function chart said "Healthcare Services 51.5%";
 * the actual roster is a dozen plastic surgeons, a PA, OR and PACU nurses,
 * aesthetic staff and the front office.
 */

import { type EntityMatcher, matchEntry, normState } from "./matching.ts";
import { classifyRole, countRoles, type RoleCount, type RoleGroup } from "./roles.ts";
import { NON_EMPLOYEE_TITLE, personKey } from "./talent-flow.ts";

// deno-lint-ignore no-explicit-any
type Any = any;

export interface RosterPerson {
  name: string;
  linkedin_profile_url: string | null;
  profile_picture_url: string | null;
  title: string | null;
  role_group: RoleGroup;
  specialty: string | null;
  subspecialty: string | null;
  start_date: string | null;
  city: string | null;
  state: string | null;
  /** The page they list (a doctor-named page of the practice, the management entity…). */
  listed_as: string | null;
  /** Latest fellowship, else residency, from their work history. */
  trained_at: string | null;
  training_kind: "fellowship" | "residency" | null;
  /** Other current clinical employers, shown so a stale entry is visible ("also at Southlake Plastic Surgery"). */
  also_at: string[];
  /** "name" when the profile lists the practice without linking the company page. */
  matched_by: "id" | "name";
}

export type RosterExclusion = "non_employee" | "side_role" | "stale_training" | "out_of_area" | "duplicate" | "no_target_entry" | "other_role";

/**
 * Which role groups a pulled group may contain. The title query is broad on
 * purpose ("doctor" also matches "Doctor of Physical Therapy" when the
 * exclusions miss a spelling); the classifier has the final word, and a row
 * it places elsewhere is dropped and counted as other_role.
 */
const GROUP_ACCEPTS: Record<string, readonly RoleGroup[] | null> = {
  doctors: ["physician"],
  trainees: ["trainee"],
  apps: ["app", "crna"],
  nurses: ["nursing"],
  clinical: ["clinical_support", "therapy"],
  executive: null,
  admin: null,
};

export interface Roster {
  people: RosterPerson[];
  role_counts: RoleCount[];
  specialties: { specialty: string; count: number }[];
  excluded: Record<RosterExclusion, number>;
  /** People whose entry names the practice but is not linked to its company page. */
  matched_by_name: number;
}

/** A resident or fellow entry older than this is a training stint that was never closed, not a current trainee. */
export const STALE_TRAINING_YEARS = 4;
const YEAR = 365.25 * 86_400_000;

function t(s: unknown): number {
  return typeof s === "string" && s ? Date.parse(s) : NaN;
}

function title(e: Any): string | null {
  return e?.title ?? e?.employee_title ?? null;
}
function entryName(e: Any): string | null {
  return e?.name ?? e?.company_name ?? null;
}

/** Fellowship first, then residency; latest end date wins. */
export function trainingOf(past: Any[], current: Any[]): { org: string; kind: "fellowship" | "residency" } | null {
  const all = [...past, ...current].filter((e) => entryName(e));
  const pick = (re: RegExp) =>
    all.filter((e) => re.test(String(title(e) ?? "").toLowerCase()) && !/\b(program|coordinator|manager|summer|research fellow)\b/i.test(String(title(e) ?? "")))
      .sort((a, b) => (t(b.end_date) || t(b.start_date) || 0) - (t(a.end_date) || t(a.start_date) || 0))[0];
  const f = pick(/\bfellow(ship)?\b/);
  if (f) return { org: entryName(f)!, kind: "fellowship" };
  const r = pick(/\bresident\b|\bresidency\b/);
  if (r) return { org: entryName(r)!, kind: "residency" };
  return null;
}

/** "Franklin, Tennessee, United States" / "Dallas" → city. */
function cityOf(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  const first = raw.split(",")[0].trim();
  if (!first || /^united states$/i.test(first)) return null;
  return first;
}

export function buildRoster(rows: Any[], matcher: EntityMatcher, nowISO: string = new Date().toISOString(), group: string | null = null): Roster {
  const now = t(nowISO);
  const accepts = group ? GROUP_ACCEPTS[group] ?? null : null;
  const excluded: Record<RosterExclusion, number> = {
    non_employee: 0, side_role: 0, stale_training: 0, out_of_area: 0, duplicate: 0, no_target_entry: 0, other_role: 0,
  };
  const seen = new Set<string>();
  const people: RosterPerson[] = [];
  let byName = 0;

  for (const row of rows ?? []) {
    const key = personKey(row);
    if (key && seen.has(key)) {
      excluded.duplicate++;
      continue;
    }
    if (key) seen.add(key);

    const loc = row?.basic_profile?.location ?? {};
    const personState = loc.state ?? null;
    const emp = row?.experience?.employment_details ?? {};
    const current: Any[] = Array.isArray(emp.current) ? emp.current : [];
    const past: Any[] = Array.isArray(emp.past) ? emp.past : [];

    // Match without the state guard first, so out-of-area is counted as its own reason.
    const loose = { ...matcher, hqState: null };
    const targets = current.filter((e) => matchEntry(loose, e) !== null);
    if (targets.length === 0) {
      excluded.no_target_entry++;
      continue;
    }
    const entry = targets.find((e) => e?.is_default === true) ??
      [...targets].sort((a, b) => (t(b.start_date) || 0) - (t(a.start_date) || 0))[0];
    const how = matchEntry(loose, entry)!;

    const ps = normState(personState);
    const entryLoc = String(entry?.location?.raw ?? "").toLowerCase();
    if (matcher.hqState && ps && ps !== matcher.hqState && !entryLoc.includes(matcher.hqState)) {
      excluded.out_of_area++;
      continue;
    }

    const ttl = title(entry);
    if (NON_EMPLOYEE_TITLE.test(ttl ?? "")) {
      excluded.non_employee++;
      continue;
    }
    const role = classifyRole(ttl);
    if (accepts && !accepts.includes(role.group)) {
      excluded.other_role++;
      continue;
    }
    if (role.group === "trainee" && Number.isFinite(t(entry?.start_date)) && now - t(entry.start_date) > STALE_TRAINING_YEARS * YEAR) {
      excluded.stale_training++;
      continue;
    }
    const others = current.filter((e) => !targets.includes(e));
    const primaryElsewhere = others.some((e) => e?.is_default === true);
    if (entry?.is_default !== true && primaryElsewhere && role.group !== "physician") {
      // Physicians commonly list a faculty or hospital title as primary while
      // practicing at the group; they stay, with the other employer shown.
      excluded.side_role++;
      continue;
    }

    const training = trainingOf(past, current);
    const bp = row?.basic_profile ?? {};
    if (how === "name") byName++;
    people.push({
      name: bp.name ?? row?.name ?? "Unknown",
      linkedin_profile_url: row?.social_handles?.professional_network_identifier?.profile_url ?? null,
      profile_picture_url: bp.profile_picture_permalink ?? null,
      title: ttl,
      role_group: role.group,
      specialty: role.specialty,
      subspecialty: role.subspecialty,
      start_date: entry?.start_date ?? null,
      city: cityOf(entry?.location?.raw) ?? loc.city ?? null,
      state: personState,
      listed_as: entryName(entry),
      trained_at: training?.org ?? null,
      training_kind: training?.kind ?? null,
      also_at: others
        .filter((e) => (t(e.start_date) || 0) >= (t(entry?.start_date) || 0) || e?.is_default === true)
        .map((e) => entryName(e))
        .filter((n): n is string => !!n)
        .slice(0, 2),
      matched_by: how,
    });
  }

  const order = (g: RoleGroup) => ["physician", "app", "crna", "trainee", "nursing", "therapy", "clinical_support", "admin", "other"].indexOf(g);
  people.sort((a, b) => order(a.role_group) - order(b.role_group) || a.name.localeCompare(b.name));

  const specMap = new Map<string, number>();
  for (const p of people) {
    if (p.role_group !== "physician") continue;
    const s = p.subspecialty ?? p.specialty;
    if (s) specMap.set(s, (specMap.get(s) ?? 0) + 1);
  }

  return {
    people,
    role_counts: countRoles(people.map((p) => p.role_group)),
    specialties: [...specMap.entries()].map(([specialty, count]) => ({ specialty, count })).sort((a, b) => b.count - a.count),
    excluded,
    matched_by_name: byName,
  };
}

/** Where staff work, city level (the entry's location, else the person's). */
export function sitesFromRoster(people: RosterPerson[]): { place: string; count: number }[] {
  const m = new Map<string, { place: string; count: number }>();
  for (const p of people) {
    if (!p.city) continue;
    const k = p.city.toLowerCase();
    const ex = m.get(k) ?? { place: p.city, count: 0 };
    ex.count++;
    m.set(k, ex);
  }
  return [...m.values()].sort((a, b) => b.count - a.count).slice(0, 8);
}

/**
 * LinkedIn's region breakdown mixes levels ("United States" 32, "Texas,
 * United States" 30, "Dallas-Fort Worth Metroplex" 27, "Dallas, TX" 17),
 * and the old panel charted them side by side as if they added up. Keep
 * city-level keys only ("Dallas, TX"); fall back to metro areas.
 */
export function sitesFromRegions(byRegion: Record<string, number> | null | undefined): { place: string; count: number }[] {
  if (!byRegion || typeof byRegion !== "object") return [];
  const entries = Object.entries(byRegion).filter(([, v]) => typeof v === "number" && v > 0);
  const city = entries.filter(([k]) => /^[^,]+,\s*[A-Z]{2}$/.test(k.trim()));
  const metro = entries.filter(([k]) => /\b(metro|metroplex|area)\b/i.test(k));
  const chosen = city.length ? city : metro;
  return chosen.map(([place, count]) => ({ place, count })).sort((a, b) => b.count - a.count).slice(0, 8);
}
