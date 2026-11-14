/**
 * Evidence-based clinical career timelines.
 *
 * Provider "years of experience" starts at the first listed job, which can be
 * a college research role. Oslr instead separates post-training clinical
 * practice from residency/fellowship time and never invents missing dates.
 * Pure module: no provider calls and no I/O.
 */

import { TRAINING_STAGES } from "./clinical-vocabulary.ts";

export type TimelineRow = Record<string, unknown>;
export type ExperienceFit = "met" | "partial" | "not_met" | "unknown";

const YEAR_MS = 365.25 * 86_400_000;
const TRAINING = /\b(?:residen(?:t|cy)|clinical\s+fellow|fellow(?:ship)?|medical\s+intern|(?:general\s+)?surgery\s+intern|surgical\s+intern|intern\s+physician|house\s+officer|registrar|trainee)\b/i;
const NON_CLINICAL_TRAINING = /\b(?:research|post[\s-]?doctoral|postdoc|teaching|laboratory|lab)\s+(?:fellow|fellowship|resident|residency)\b/i;
const FORMER = /\b(?:former|previous|prior|graduated|completed|alumn(?:us|a)|ex[-\s])\b/i;
const STUDENT = /\b(?:student|undergraduate|internship|summer\s+intern|medical\s+assistant\s+intern)\b/i;
const NON_LICENSED_CLINICAL_SUPPORT = /\b(?:nurse'?s?\s+(?:attendant|attendent|aide|assistant)|nursing\s+(?:assistant|aide|attendant|attendent)|medical\s+assistant|patient\s+care\s+(?:assistant|technician|tech)|volunteer|observer(?:ship)?|shadow(?:ing)?)\b/i;
const PRACTICE = /\b(?:physician|surgeon|surgery|doctor|attending|podiatrist|podiatric|hospitalist|clinician|medical\s+director|chief\s+medical|nurse|nursing|\brn\b|nurse\s+practitioner|\bnp\b|physician\s+assistant|\bpa\b|physiatrist|anesthetist|midwife|dentist|therapist|pharmacist)\b/i;

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function rows(value: unknown): TimelineRow[] {
  return Array.isArray(value) ? value.filter((v): v is TimelineRow => !!v && typeof v === "object" && !Array.isArray(v)) : [];
}

function company(e: TimelineRow): string {
  return text(e.company_name ?? e.name ?? e.company);
}

function roleText(e: TimelineRow): string {
  return [text(e.title), company(e), text(e.summary ?? e.description)].filter(Boolean).join(" ");
}

function dateValue(value: unknown): number | null {
  const raw = text(value);
  if (!raw || /^(?:present|current|now)$/i.test(raw)) return null;
  const match = raw.match(/^(\d{4})(?:-(\d{1,2}))?(?:-(\d{1,2}))?/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = match[2] ? Number(match[2]) - 1 : 0;
  const day = match[3] ? Number(match[3]) : 1;
  const valueMs = Date.UTC(year, month, day);
  return Number.isFinite(valueMs) ? valueMs : null;
}

function monthLabel(ms: number): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(ms));
}

function isOpenEnded(e: TimelineRow): boolean {
  const end = e.end_date;
  return end === null || end === undefined || text(end) === "" || /^(?:present|current|now)$/i.test(text(end));
}

export function isTrainingEmployment(e: TimelineRow): boolean {
  const title = text(e.title);
  if (!title || FORMER.test(title)) return false;
  if (NON_CLINICAL_TRAINING.test(title)) return false;
  if (/\bfellow(?:ship)?\b/i.test(title) && /\b(?:research|post[\s-]?baccalaureate|intramural|laboratory|nih\s+academy)\b/i.test(title)) return false;
  if (/\bmedical\s+student\b/i.test(title) || /\bresident\s+(?:advisor|assistant)\b/i.test(title)) return false;
  if (/\bfellowship[-\s]+trained\b/i.test(title) && !/\bfellow\b/i.test(title)) return false;
  if (/\bintern\b/i.test(title) && !/\b(?:medical|physician|resident|podiatric|surgical|surgery|clinical)\b/i.test(title)) return false;
  if (TRAINING.test(title)) return true;
  const program = /\b(?:residency|fellowship)(?:\s+program)?\b/i.test(company(e));
  const genericDoctor = /\b(?:physician|doctor|clinician)\b/i.test(title) && !/\b(?:surgeon|attending|director|chief)\b/i.test(title);
  return program && genericDoctor;
}

export function isPracticeEmployment(e: TimelineRow): boolean {
  const title = text(e.title);
  if (!title || isTrainingEmployment(e) || STUDENT.test(title) || FORMER.test(title) || NON_LICENSED_CLINICAL_SUPPORT.test(title)) return false;
  if (/\b(?:research|teaching|lab|laboratory)\s+(?:assistant|associate|coordinator|fellow|intern)\b/i.test(title)) return false;
  return PRACTICE.test(title);
}

interface Interval { start: number; end: number }

/** Merge overlapping roles so concurrent appointments never double-count. */
function elapsedYears(employers: TimelineRow[], nowMs: number): { years: number | null; earliest: number | null } {
  const intervals: Interval[] = [];
  for (const e of employers) {
    const start = dateValue(e.start_date);
    if (start === null || start > nowMs) continue;
    const parsedEnd = dateValue(e.end_date);
    const end = isOpenEnded(e) ? nowMs : parsedEnd;
    if (end === null || end <= start) continue;
    intervals.push({ start, end: Math.min(end, nowMs) });
  }
  if (intervals.length === 0) return { years: null, earliest: null };
  intervals.sort((a, b) => a.start - b.start);
  const merged: Interval[] = [{ ...intervals[0] }];
  for (const next of intervals.slice(1)) {
    const last = merged[merged.length - 1];
    if (next.start <= last.end) last.end = Math.max(last.end, next.end);
    else merged.push({ ...next });
  }
  const total = merged.reduce((sum, i) => sum + i.end - i.start, 0);
  return { years: Math.floor(total / YEAR_MS), earliest: intervals[0].start };
}

export interface ClinicalTimeline {
  active_practice_years: number | null;
  training_years: number | null;
  active_practice_since: string | null;
  training_since: string | null;
  experience_basis: string;
  experience_evidence: string | null;
}

export function clinicalTimeline(profile: TimelineRow, now: Date = new Date()): ClinicalTimeline {
  const history = rows(profile.experience_history);
  const fallback = history.length > 0 ? history : [...rows(profile.current_employers), ...rows(profile.past_employers)];
  const practice = elapsedYears(fallback.filter(isPracticeEmployment), now.getTime());
  const training = elapsedYears(fallback.filter(isTrainingEmployment), now.getTime());
  const evidence = practice.earliest !== null
    ? `${practice.years} completed years across dated post-training clinical roles; earliest listed role began ${monthLabel(practice.earliest)}; education and training are separate`
    : training.earliest !== null
    ? "No dated post-training clinical role is listed; residency and fellowship time are not counted as practice experience"
    : "No dated post-training clinical role is listed";
  return {
    active_practice_years: practice.years,
    training_years: training.years,
    active_practice_since: practice.earliest !== null ? new Date(practice.earliest).toISOString().slice(0, 10) : null,
    training_since: training.earliest !== null ? new Date(training.earliest).toISOString().slice(0, 10) : null,
    experience_basis: "post_training_clinical_roles",
    experience_evidence: evidence,
  };
}

export type TimelineAnnotated = ClinicalTimeline & {
  audit_verdict?: unknown;
  audit_score?: number;
  audit_reason?: string | null;
  training_filtered?: boolean;
};

export function annotateClinicalTimeline<R extends TimelineRow>(row: R, now: Date = new Date()): R & ClinicalTimeline {
  return { ...row, ...clinicalTimeline(row, now) };
}

export function experienceFit(
  profile: TimelineRow,
  range: { min?: number | null; max?: number | null },
  now: Date = new Date(),
): { status: ExperienceFit; years: number | null; evidence: string } {
  const timeline = clinicalTimeline(profile, now);
  const years = timeline.active_practice_years;
  if (years === null) return { status: "unknown", years, evidence: timeline.experience_evidence ?? "Practice dates are not listed" };
  const below = range.min !== null && range.min !== undefined && years < range.min;
  const above = range.max !== null && range.max !== undefined && years > range.max;
  const near = (range.min !== null && range.min !== undefined && years === range.min - 1) ||
    (range.max !== null && range.max !== undefined && years === range.max + 1);
  return {
    status: below || above ? (near ? "partial" : "not_met") : "met",
    years,
    evidence: timeline.experience_evidence ?? `${years} years in post-training clinical roles`,
  };
}

export interface TrainingStageRequest {
  profession?: string | null;
  professions?: string[];
  stage: "residency" | "fellowship" | "internship" | "medical_school";
  stages?: TrainingStageRequest["stage"][];
  year?: number | null;
  years?: number[];
  title_terms?: string[];
}

export interface CurrentTrainingAssessment {
  eligible: boolean;
  reason: string | null;
  current_stage: TrainingStageRequest["stage"] | null;
}

function currentEmployers(profile: TimelineRow): TimelineRow[] {
  const current = rows(profile.current_employers);
  if (current.length > 0) return current;
  // Search rows merge current and past employment into one history. An open
  // end date is the only acceptable fallback; a past fellowship never counts.
  return rows(profile.experience_history).filter((e) => e.is_current === true || e.is_primary === true);
}

function stageOf(e: TimelineRow): TrainingStageRequest["stage"] | null {
  const value = `${text(e.title)} ${company(e)}`.toLowerCase();
  if (/\b(?:fellow|fellowship)\b/.test(value)) return "fellowship";
  if (/\b(?:resident|residency|house officer|registrar)\b/.test(value)) return "residency";
  if (/\b(?:medical intern|intern physician|general surgery intern|surgery intern|surgical intern)\b/.test(value)) return "internship";
  if (/\bmedical student\b/.test(value)) return "medical_school";
  return null;
}

function typicalYears(stage: TrainingStageRequest, name: TrainingStageRequest["stage"]): number {
  const def = TRAINING_STAGES[name];
  if (!def) return 1;
  const professions = [...(stage.professions ?? []), stage.profession ?? ""].map((p) => p.toLowerCase().trim());
  for (const profession of professions) if (def.typicalYears[profession]) return def.typicalYears[profession];
  return def.typicalYears.default;
}

/**
 * Current trainee asks require a current training role. Past fellowships,
 * explicit former-fellow language, later attending roles, and open training
 * entries beyond the specialty's normal duration plus six months are excluded.
 */
export function assessCurrentTraining(
  profile: TimelineRow,
  stage: TrainingStageRequest | null | undefined,
  now: Date = new Date(),
): CurrentTrainingAssessment {
  if (!stage) return { eligible: true, reason: null, current_stage: null };
  const current = currentEmployers(profile);
  const allowed = new Set(stage.stages?.length ? stage.stages : [stage.stage]);
  const training = current.filter((e) => {
    const roleStage = stageOf(e);
    return roleStage !== null && allowed.has(roleStage) && isTrainingEmployment(e);
  });
  const practice = current.filter(isPracticeEmployment);
  const primary = current.find((e) => e.is_primary === true || e.is_default === true) ?? current[0];
  const newestPractice = practice.map((e) => dateValue(e.start_date) ?? 0).reduce((a, b) => Math.max(a, b), 0);
  const newestTraining = training.map((e) => dateValue(e.start_date) ?? 0).reduce((a, b) => Math.max(a, b), 0);

  if (training.length === 0) {
    return { eligible: false, reason: "No current residency or fellowship role is listed", current_stage: null };
  }
  if (practice.length > 0 && ((primary ? isPracticeEmployment(primary) : false) || newestPractice >= newestTraining)) {
    return { eligible: false, reason: "A later or primary independent clinical role is listed, so the training role is not current", current_stage: null };
  }

  const requestedYears = (stage.years ?? []).filter((y) => Number.isFinite(y) && y > 0);
  let undated = false;
  let outsideYear: number | null = null;
  for (const e of training) {
    const roleStage = stageOf(e)!;
    const started = dateValue(e.start_date);
    if (started === null) { undated = true; continue; }
    const elapsed = Math.max(0, now.getTime() - started) / YEAR_MS;
    const trainingYear = Math.floor(elapsed) + 1;
    if (requestedYears.length > 0 && !requestedYears.includes(trainingYear)) {
      outsideYear = trainingYear;
      continue;
    }
    const limitMs = (typicalYears(stage, roleStage) * 365.25 + 183) * 86_400_000;
    if (now.getTime() - started <= limitMs) return { eligible: true, reason: null, current_stage: roleStage };
  }
  if (undated) return { eligible: true, reason: null, current_stage: stageOf(training[0]) };
  if (outsideYear !== null) {
    return { eligible: false, reason: `Current role is PGY-${outsideYear}, outside the requested PGY-${requestedYears.join("/")} window`, current_stage: null };
  }
  const first = training[0];
  return {
    eligible: false,
    reason: `${text(first.title) || "Training role"} started ${monthLabel(dateValue(first.start_date)!)}, beyond the expected ${stageOf(first)} duration`,
    current_stage: null,
  };
}

/** A completed-fellowship ask must never serve someone still in training. */
export function currentClinicalTrainingReason(row: TimelineRow, now: Date = new Date()): string | null {
  const current = currentEmployers(row);
  const training = current.filter((e) => stageOf(e) !== null && isTrainingEmployment(e));
  if (training.length === 0) return null;
  const practice = current.filter(isPracticeEmployment);
  const primary = current.find((e) => e.is_primary === true || e.is_default === true) ?? current[0];
  const newestPractice = practice.map((e) => dateValue(e.start_date) ?? 0).reduce((a, b) => Math.max(a, b), 0);
  const newestTraining = training.map((e) => dateValue(e.start_date) ?? 0).reduce((a, b) => Math.max(a, b), 0);
  // A stale open fellowship beside a later attending role is history, not a
  // reason to exclude a practicing fellowship-trained clinician.
  if (practice.length > 0 && ((primary ? isPracticeEmployment(primary) : false) || newestPractice >= newestTraining)) return null;
  const stage = stageOf(training[0]);
  return stage ? `Currently in ${stage}; the request is for a clinician who has completed training` : null;
}

export function splitCurrentTrainingRows<R extends TimelineRow>(
  input: R[],
  stage: TrainingStageRequest | null | undefined,
  now: Date = new Date(),
): { clean: Array<R & TimelineAnnotated>; rejected: Array<R & TimelineAnnotated> } {
  if (!stage) return { clean: input.map((row) => annotateClinicalTimeline(row, now)), rejected: [] };
  const clean: Array<R & TimelineAnnotated> = [];
  const rejected: Array<R & TimelineAnnotated> = [];
  for (const original of input) {
    const row = annotateClinicalTimeline(original, now) as R & TimelineAnnotated;
    const assessment = assessCurrentTraining(row, stage, now);
    if (assessment.eligible) clean.push(row);
    else {
      row.audit_verdict = "reject";
      row.audit_score = 0;
      row.audit_reason = assessment.reason;
      row.training_filtered = true;
      rejected.push(row);
    }
  }
  return { clean, rejected };
}

/** Enforce explicit practice ranges only when the dates support a decision. */
export function splitExperienceRows<R extends TimelineRow>(
  input: R[],
  range: { min?: number | null; max?: number | null } | null | undefined,
  now: Date = new Date(),
): { clean: Array<R & TimelineAnnotated>; rejected: Array<R & TimelineAnnotated> } {
  if (!range || (typeof range.min !== "number" && typeof range.max !== "number")) {
    return { clean: input.map((row) => annotateClinicalTimeline(row, now)), rejected: [] };
  }
  const clean: Array<R & TimelineAnnotated> = [];
  const rejected: Array<R & TimelineAnnotated> = [];
  for (const original of input) {
    const row = annotateClinicalTimeline(original, now) as R & TimelineAnnotated;
    const fit = experienceFit(row, range, now);
    if (fit.status === "met" || fit.status === "unknown") clean.push(row);
    else {
      row.audit_verdict = "reject";
      row.audit_score = 0;
      row.audit_reason = fit.evidence;
      rejected.push(row);
    }
  }
  return { clean, rejected };
}
