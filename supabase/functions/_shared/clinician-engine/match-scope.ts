/**
 * match-scope.ts — deterministic ranking for clinician results.
 *
 * Two stable sorts that run BEFORE the AI audit, so a degraded audit still
 * shows a sane page (blueprint §6):
 *
 *  1. rankByMatchScope — primary vs secondary current-role match. Profiles
 *     often carry multiple concurrent employments (probe A: a practice owner
 *     with a never-closed 2010 "Chief Resident" entry), so a row whose
 *     PRIMARY current employment satisfies the ask ranks above one that
 *     matched only via a secondary/stale entry. Primary employment = the
 *     is_default === true entry when the API returns it, else the first.
 *
 *  2. rankByStageFit — training-stage year math. When the ask carries a
 *     training_stage with a year (PGY-3), rows whose primary role start_date
 *     falls in the expected window rank first, unknown dates middle, clearly
 *     out-of-window last. Deterministic date math; the grader re-verifies
 *     with full context. Ported concept from the reference's award/seniority
 *     evidence tiering — the clinician analog of "evidence first".
 *
 * Pure: no I/O. Secondary/stale matches are kept (billed and sometimes
 * right), ranked lower and labelled for the UI.
 */

import type { SearchCriteria, SpecialtyValue, TrainingStageValue } from "./clinician-criteria.ts";
import { safeTitleTerms } from "./build-clinician-query.ts";
import { TRAINING_STAGES } from "./clinical-vocabulary.ts";

export type MatchScope = "primary" | "secondary";

export interface ScopedProfile<P> {
  profile: P;
  match_scope: MatchScope;
}

interface EmploymentLike {
  title?: unknown;
  name?: unknown;
  is_default?: unknown;
  start_date?: unknown;
  end_date?: unknown;
}
interface ProfileLike {
  current_employers?: unknown;
  headline?: unknown;
}

/**
 * Match terms the scope check mirrors, per criterion kind. Title terms are
 * primary evidence only in the primary role's TITLE; specialty / role_class /
 * training_stage terms are primary evidence on any surface their filter
 * enforces (title, employer name, headline). Specialty criteria whose tense
 * is "past"/"any" are excluded — a past-tense requirement cannot demote a
 * row for not being on the CURRENT primary role.
 */
function scopeTerms(criteria: SearchCriteria[]): { titleTerms: string[]; broadTerms: string[] } {
  const titleTerms: string[] = [];
  const broadTerms: string[] = [];
  for (const c of criteria) {
    if (c.enforcement !== "hard") continue;
    if (c.kind === "title") {
      const v = c.value as { terms?: string[] } | string[];
      const terms = Array.isArray(v) ? v : (v?.terms ?? []);
      titleTerms.push(...safeTitleTerms(terms).kept);
    } else if (c.kind === "role_class" || c.kind === "training_stage") {
      const v = c.value as { terms?: string[]; title_terms?: string[] } | null;
      for (const t of [...(v?.terms ?? []), ...(v?.title_terms ?? [])]) {
        if (typeof t === "string" && t.trim()) titleTerms.push(t.toLowerCase().trim());
      }
    } else if (c.kind === "specialty") {
      const raw = c.value as SpecialtyValue | string[];
      const terms = Array.isArray(raw) ? raw : raw?.terms ?? [];
      const tense = Array.isArray(raw) ? "current" : raw?.tense ?? "current";
      if (tense !== "current") continue;
      for (const t of terms) {
        if (typeof t === "string" && t.trim()) broadTerms.push(t.toLowerCase().trim());
      }
    }
  }
  return { titleTerms, broadTerms };
}

/** Primary current employment: is_default === true when present, else first. */
export function primaryEmployment(profile: unknown): EmploymentLike | null {
  const cur = (profile as ProfileLike | null)?.current_employers;
  if (!Array.isArray(cur) || cur.length === 0) return null;
  const flagged = cur.find((e) => e && typeof e === "object" && (e as EmploymentLike).is_default === true);
  return (flagged ?? cur[0]) as EmploymentLike;
}

export function computeMatchScope(profile: unknown, criteria: SearchCriteria[]): MatchScope {
  const { titleTerms, broadTerms } = scopeTerms(criteria);
  if (titleTerms.length === 0 && broadTerms.length === 0) return "primary";
  const emp = primaryEmployment(profile);
  if (!emp) return "secondary";
  const title = typeof emp.title === "string" ? emp.title.toLowerCase() : "";
  const employer = typeof emp.name === "string" ? emp.name.toLowerCase() : "";
  const headline = typeof (profile as ProfileLike | null)?.headline === "string"
    ? ((profile as ProfileLike).headline as string).toLowerCase()
    : "";
  if (titleTerms.some((t) => title.includes(t) || headline.includes(t))) return "primary";
  if (broadTerms.some((t) => title.includes(t) || employer.includes(t) || headline.includes(t))) {
    return "primary";
  }
  return "secondary";
}

export function rankByMatchScope<P>(profiles: P[], criteria: SearchCriteria[]): ScopedProfile<P>[] {
  const scoped = profiles.map((profile, i) => ({
    profile,
    match_scope: computeMatchScope(profile, criteria),
    i,
  }));
  scoped.sort((a, b) => {
    const tier = (s: MatchScope) => (s === "primary" ? 0 : 1);
    return tier(a.match_scope) - tier(b.match_scope) || a.i - b.i;
  });
  return scoped.map(({ profile, match_scope }) => ({ profile, match_scope }));
}

/* ------------------------------------------------------------------ */
/*  Training-stage year math                                           */
/* ------------------------------------------------------------------ */

export type StageFit = "in_window" | "unknown" | "out_of_window";

/**
 * Expected start window for a stage-year ask, computed at `now`:
 * a PGY-N clinician in academic year Y started their program N-1 years
 * before the current academic year's July, ± 10 months of slack (programs
 * start May–September; probe A's genuine PGY-3 started 2026-06 for a fall
 * 2026 search — window must include it).
 */
export function stageStartWindow(
  year: number,
  now: Date = new Date(),
): { from: Date; to: Date } {
  // Academic year anchor: July 1 of the current academic year.
  const academicYearStart = now.getUTCMonth() >= 6
    ? Date.UTC(now.getUTCFullYear(), 6, 1)
    : Date.UTC(now.getUTCFullYear() - 1, 6, 1);
  const expectedStart = new Date(academicYearStart);
  expectedStart.setUTCFullYear(expectedStart.getUTCFullYear() - (year - 1));
  const from = new Date(expectedStart);
  from.setUTCMonth(from.getUTCMonth() - 10);
  const to = new Date(expectedStart);
  to.setUTCMonth(to.getUTCMonth() + 10);
  return { from, to };
}

export function stageFit(
  profile: unknown,
  stage: TrainingStageValue,
  now: Date = new Date(),
): StageFit {
  if (!stage.year) return "unknown";
  const emp = primaryEmployment(profile);
  // The stage-matching role may be a secondary entry; check every current
  // employment whose title matches a stage term, preferring the primary.
  const cur = ((profile as ProfileLike | null)?.current_employers ?? []) as EmploymentLike[];
  // Match on the stage's title terms OR the stage's root word: a stale
  // "Chief Resident- Podiatric Medicine & Surgery" entry (probe A) matches
  // no profession-qualified phrase but is unmistakably a residency role, and
  // its 2010 start date is exactly what this check exists to catch.
  const STAGE_ROOT: Record<string, string> = {
    residency: "resident",
    fellowship: "fellow",
    internship: "intern",
    medical_school: "student",
  };
  const root = STAGE_ROOT[stage.stage] ?? "";
  const stageTitleHit = (e: EmploymentLike) => {
    const t = typeof e.title === "string" ? e.title.toLowerCase() : "";
    if (root && t.includes(root)) return true;
    return stage.title_terms.some((term) => t.includes(term.toLowerCase()));
  };
  const candidates = [emp, ...cur].filter(
    (e): e is EmploymentLike => !!e && stageTitleHit(e),
  );
  if (candidates.length === 0) return "unknown";
  const { from, to } = stageStartWindow(stage.year, now);
  for (const e of candidates) {
    const raw = typeof e.start_date === "string" ? e.start_date : null;
    if (!raw) continue;
    const started = new Date(raw);
    if (Number.isNaN(started.getTime())) continue;
    if (started >= from && started <= to) return "in_window";
    return "out_of_window";
  }
  return "unknown";
}

/**
 * Rank a stage-year ask: in-window starts first, unknown dates middle,
 * out-of-window last. Attaches stage_fit to each row so the card and the
 * grader can see the call. Stable within tiers.
 */
export function rankByStageFit<R extends Record<string, unknown>>(
  rows: R[],
  criteria: SearchCriteria[],
  now: Date = new Date(),
): R[] {
  const stageCriterion = criteria.find(
    (c) => c.kind === "training_stage" && c.enforcement === "hard",
  );
  const stage = stageCriterion?.value as TrainingStageValue | undefined;
  if (!stage || !stage.year) return rows;

  const tierOf = (fit: StageFit) => (fit === "in_window" ? 0 : fit === "unknown" ? 1 : 2);
  return rows
    .map((row, i) => {
      const fit = stageFit(row, stage, now);
      (row as Record<string, unknown>).stage_fit = fit;
      return { row, tier: tierOf(fit), i };
    })
    .sort((a, b) => a.tier - b.tier || a.i - b.i)
    .map(({ row }) => row);
}

/** Typical program length for a stage/profession (grader context). */
export function typicalProgramYears(stage: TrainingStageValue): number {
  const def = TRAINING_STAGES[stage.stage];
  if (!def) return 3;
  const p = (stage.profession ?? "").toLowerCase().trim();
  return def.typicalYears[p] ?? def.typicalYears.default;
}
