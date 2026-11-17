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
  company_name?: unknown;
  summary?: unknown;
  is_default?: unknown;
  start_date?: unknown;
  end_date?: unknown;
}
interface ProfileLike {
  current_employers?: unknown;
  experience_history?: unknown;
  headline?: unknown;
  summary?: unknown;
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

export interface StageAssessment {
  fit: StageFit;
  evidence: string;
  stated_years: number[];
}

function statedPgyYears(value: unknown): number[] {
  if (typeof value !== "string" || !value) return [];
  const years = new Set<number>();
  const expressions = value.match(/\bpgy[\s-]*(?:level[\s-]*)?\d+(?:\s*(?:,|and|or|\/|&)\s*(?:pgy[\s-]*)?\d+)*/gi) ?? [];
  for (const expression of expressions) {
    for (const match of expression.matchAll(/\d+/g)) {
      const year = Number(match[0]);
      if (year >= 1 && year <= 10) years.add(year);
    }
  }
  return [...years];
}

/**
 * Explicit PGY language beats date estimates. Fellows and chief residents
 * remain in senior-resident searches because their role is direct evidence;
 * date math alone never deletes research-year or chief-year candidates.
 */
export function assessStageFit(
  profile: unknown,
  stage: TrainingStageValue,
  now: Date = new Date(),
): StageAssessment {
  const years = stage.years && stage.years.length > 0 ? stage.years : stage.year ? [stage.year] : [];
  if (years.length === 0) return { fit: "unknown", evidence: "Training year not requested", stated_years: [] };
  const p = profile as ProfileLike | null;
  const cur = (p?.current_employers ?? []) as EmploymentLike[];
  const requestedStages = new Set(stage.stages && stage.stages.length > 0 ? stage.stages : [stage.stage]);
  const fellowIsSeniorMatch = stage.senior_fellow_recall === true ||
    (requestedStages.has("residency") && !requestedStages.has("fellowship"));
  if (fellowIsSeniorMatch) requestedStages.add("fellowship");
  const STAGE_ROOT: Record<string, string> = {
    residency: "resident",
    fellowship: "fellow",
    internship: "intern",
    medical_school: "student",
  };
  const roots = [...requestedStages].map((stageName) => STAGE_ROOT[stageName] ?? "");
  const roleStage = (e: EmploymentLike): string | null => {
    const t = `${typeof e.title === "string" ? e.title : ""} ${typeof e.name === "string" ? e.name : ""} ${typeof e.company_name === "string" ? e.company_name : ""}`.toLowerCase();
    for (const stageName of requestedStages) {
      const root = STAGE_ROOT[stageName] ?? "";
      if (root && t.includes(root)) return stageName;
    }
    return stage.title_terms.some((term) => t.includes(term.toLowerCase())) ? stage.stage : null;
  };
  const candidates = cur.filter((e) => !!e && roleStage(e) !== null);
  if (candidates.length === 0) return { fit: "unknown", evidence: "Current training role is not dated", stated_years: [] };

  const globalText = [p?.headline, p?.summary].filter((v): v is string => typeof v === "string").join(" ");
  const globalYears = statedPgyYears(globalText);
  let sawDate = false;
  let sawStatedOutside = false;
  const allStated = new Set<number>(globalYears);
  for (const e of candidates) {
    const title = typeof e.title === "string" ? e.title : "";
    const currentStage = roleStage(e);
    if (currentStage === "fellowship" && fellowIsSeniorMatch) {
      return { fit: "in_window", evidence: `${title || "Current fellow"} — included as a relevant senior-training match`, stated_years: [...allStated] };
    }
    if (currentStage === "residency" && /\bchief\s+resident\b/i.test(title) && years.some((year) => year >= 4)) {
      return { fit: "in_window", evidence: `${title} — chief-resident evidence; no date cutoff applied`, stated_years: [...allStated] };
    }
    const stated = [...new Set([...statedPgyYears(title), ...statedPgyYears(e.summary), ...globalYears])];
    stated.forEach((year) => allStated.add(year));
    const direct = stated.find((year) => years.includes(year));
    if (direct !== undefined) {
      return { fit: "in_window", evidence: `${title || "Current training role"} states PGY-${direct}`, stated_years: [...allStated] };
    }
    if (stated.length > 0) sawStatedOutside = true;
  }
  // A stated year is stronger than a conflicting estimate from role dates.
  if (sawStatedOutside) {
    return { fit: "out_of_window", evidence: `Profile states ${[...allStated].map((year) => `PGY-${year}`).join(" / ")} rather than ${years.map((year) => `PGY-${year}`).join(" / ")}`, stated_years: [...allStated] };
  }
  for (const e of candidates) {
    const raw = typeof e.start_date === "string" ? e.start_date : null;
    if (!raw) continue;
    const started = new Date(raw);
    if (Number.isNaN(started.getTime())) continue;
    sawDate = true;
    if (years.some((year) => {
      const { from, to } = stageStartWindow(year, now);
      return started >= from && started <= to;
    })) {
      return {
        fit: "in_window",
        evidence: `${typeof e.title === "string" && e.title ? e.title : "Current training role"} started ${raw.slice(0, 7)} — estimated ${years.map((year) => `PGY-${year}`).join(" / ")} from the listed start date`,
        stated_years: [...allStated],
      };
    }
  }
  return {
    fit: sawDate ? "out_of_window" : "unknown",
    evidence: sawDate
      ? "Listed start dates suggest another training year; research years and title resets can make this estimate imprecise"
      : "Current training role has no start date or stated PGY year",
    stated_years: [...allStated],
  };
}

export function stageFit(
  profile: unknown,
  stage: TrainingStageValue,
  now: Date = new Date(),
): StageFit {
  return assessStageFit(profile, stage, now).fit;
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
  if (!stage || (!stage.year && (!stage.years || stage.years.length === 0))) return rows;

  const tierOf = (fit: StageFit) => (fit === "in_window" ? 0 : fit === "unknown" ? 1 : 2);
  return rows
    .map((row, i) => {
      const assessment = assessStageFit(row, stage, now);
      (row as Record<string, unknown>).stage_fit = assessment.fit;
      (row as Record<string, unknown>).stage_evidence = assessment.evidence;
      (row as Record<string, unknown>).stated_pgy_years = assessment.stated_years;
      return { row, tier: tierOf(assessment.fit), i };
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
