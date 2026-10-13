/**
 * employment-model.ts — hospital-employed vs private practice, decided on
 * the PRIMARY current employer (2026-10-13).
 *
 * Why in-process: the provider's current-employer filters are element-
 * scoped across every concurrent employment, and a private-practice
 * surgeon routinely lists hospital privileges as a second current entry.
 * The query therefore only PULLS likely rows (positive clauses, see
 * build-clinician-query.ts); this module reads the row the way a recruiter
 * would — who signs the paycheck — and hides contradictions with the
 * evidence attached. Every row also gets the read annotated for the grader
 * and the soft ranker, whether or not the ask is hard.
 *
 * Binary by decision: hospitals, health systems, academic centers,
 * government care, and the physician groups those own are
 * "hospital_employed"; every other care-delivery employer (solo/group
 * practices, ASCs, dental groups, DSOs, PE-backed groups) is
 * "private_practice". Pure: no I/O.
 */

import type { EmploymentModelValue, SearchCriteria } from "./clinician-criteria.ts";
import {
  containsWholePhrase,
  type EmploymentModel,
  HEALTH_SYSTEM_BRANDS,
  HOSPITAL_SYSTEM_TOKENS,
  PRACTICE_HEADCOUNT_CAP,
  PRIVATE_PRACTICE_TOKENS,
} from "./clinical-vocabulary.ts";

/** Above this, an unbranded employer is a system even with a practice-like name. */
export const LARGE_SYSTEM_HEADCOUNT = 5000;

export type EmploymentRead = EmploymentModel | "unknown";

export interface EmploymentVerdict {
  model: EmploymentRead;
  /** Short, recruiter-readable reason ("name: Baptist Health"). */
  evidence: string;
}

interface EmployerLike {
  name?: unknown;
  headcount?: unknown;
  is_primary?: unknown;
  title?: unknown;
  seniority_level?: unknown;
}

interface RowLike {
  job_title?: unknown;
  job_company_name?: unknown;
  job_seniority_level?: unknown;
  current_employers?: unknown;
}

const OWNER_TITLE = /\b(owner|founder|co-founder|partner|managing partner|principal|proprietor)\b/i;

function s(v: unknown): string {
  return typeof v === "string" ? v : "";
}
function n(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** Classify one employer name (+ optional headcount and owner signal). */
export function classifyEmploymentModel(
  name: string | null | undefined,
  opts: { headcount?: number | null; ownerSignal?: boolean } = {},
): EmploymentVerdict {
  const raw = s(name).trim();
  const lower = raw.toLowerCase();
  const headcount = opts.headcount ?? null;

  if (lower) {
    for (const brand of HEALTH_SYSTEM_BRANDS) {
      if (containsWholePhrase(lower, brand)) return { model: "hospital_employed", evidence: `system brand: ${raw}` };
    }
    for (const token of HOSPITAL_SYSTEM_TOKENS) {
      if (containsWholePhrase(lower, token)) return { model: "hospital_employed", evidence: `employer name says "${token}": ${raw}` };
    }
  }
  if (headcount !== null && headcount >= LARGE_SYSTEM_HEADCOUNT) {
    return { model: "hospital_employed", evidence: `employer headcount ${headcount}: ${raw || "unnamed"}` };
  }
  if (lower) {
    for (const token of PRIVATE_PRACTICE_TOKENS) {
      if (containsWholePhrase(lower, token)) return { model: "private_practice", evidence: `practice-shaped employer: ${raw}` };
    }
  }
  if (opts.ownerSignal) {
    return { model: "private_practice", evidence: `owner/partner at ${raw || "their practice"}` };
  }
  if (headcount !== null && headcount > 0 && headcount <= PRACTICE_HEADCOUNT_CAP) {
    return { model: "private_practice", evidence: `employer headcount ${headcount}: ${raw}` };
  }
  return { model: "unknown", evidence: raw ? `no employer-type signal in "${raw}"` : "no current employer" };
}

/** The read for a card row, from its PRIMARY current employer. */
export function readRowEmploymentModel(row: RowLike): EmploymentVerdict {
  const list = Array.isArray(row.current_employers) ? (row.current_employers as EmployerLike[]) : [];
  const primary = list.find((e) => e && e.is_primary === true) ?? list[0] ?? null;
  const name = s(primary?.name) || s(row.job_company_name);
  const headcount = n(primary?.headcount);
  const title = s(primary?.title) || s(row.job_title);
  const seniority = s(primary?.seniority_level) || s(row.job_seniority_level);
  const ownerSignal = OWNER_TITLE.test(title) || /owner|partner/i.test(seniority);
  return classifyEmploymentModel(name, { headcount, ownerSignal });
}

export function askedEmploymentModel(criteria: SearchCriteria[]): { model: EmploymentModel; hard: boolean } | null {
  const c = criteria.find((x) => x.kind === "employment_model" && x.enforcement !== "dropped");
  if (!c) return null;
  const model = (c.value as EmploymentModelValue | null)?.model;
  if (model !== "private_practice" && model !== "hospital_employed") return null;
  return { model, hard: c.enforcement === "hard" };
}

export interface EmploymentSplit<R> {
  kept: R[];
  rejected: R[];
}

/**
 * Annotate every row with its read; when the ask is HARD, move rows whose
 * read contradicts it into `rejected` (annotated like grader rejects).
 * "unknown" reads are kept — the grader decides those with full context.
 */
export function applyEmploymentModel<R extends RowLike & Record<string, unknown>>(
  rows: R[],
  criteria: SearchCriteria[],
): EmploymentSplit<R> {
  const asked = askedEmploymentModel(criteria);
  const kept: R[] = [];
  const rejected: R[] = [];
  for (const row of rows) {
    const read = readRowEmploymentModel(row);
    const annotated = row as Record<string, unknown>;
    annotated.employment_model = read.model;
    annotated.employment_model_evidence = read.evidence;
    if (asked && asked.hard && read.model !== "unknown" && read.model !== asked.model) {
      const wanted = asked.model === "private_practice" ? "private practice" : "hospital-employed";
      annotated.audit_verdict = "reject";
      annotated.audit_score = 0;
      annotated.audit_reason = `Not ${wanted}: ${read.evidence}.`;
      annotated.audit_evidence = s(row.job_company_name).slice(0, 140) || null;
      annotated.employment_filtered = true;
      rejected.push(row);
    } else {
      kept.push(row);
    }
  }
  return { kept, rejected };
}
