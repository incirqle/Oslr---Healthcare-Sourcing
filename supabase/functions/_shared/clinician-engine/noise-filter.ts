/**
 * noise-filter.ts — deterministic role-class noise rejection, BEFORE the
 * AI audit.
 *
 * Live failure 2026-10-12 ("orthopedic surgeons in Miami, Florida"): the
 * provider pool was 74% noise — Doctors of Physical Therapy, Physician
 * Assistants, physician recruiters, device reps — every one admitted by a
 * loose word in the role gate and every one paid for twice: once as a
 * fetched row, once as an Opus grader call that could only say "not a
 * surgeon". A title or headline that NAMES another license class (or a
 * vendor / recruiter role) is proof enough; no model needed.
 *
 * Pure: no I/O. Only fires for role classes with an entry in
 * ROLE_CLASS_NOISE; a therapist ask never filters therapists. Rows are
 * never discarded — they ride hidden_results with the matched evidence so
 * the recruiter can still reveal them.
 */

import type { RoleClassValue, SearchCriteria } from "./clinician-criteria.ts";
import { ROLE_CLASS_NOISE } from "./clinical-vocabulary.ts";

export interface NoiseCheckRow {
  job_title?: string | null;
  headline?: string | null;
}

export interface NoiseVerdict {
  /** The pattern source that proved the row is outside the asked class. */
  evidence: string;
  /** Which surface carried it. */
  surface: "title" | "headline";
}

function s(v: unknown): string {
  return typeof v === "string" ? v : "";
}

/** Role-class keys the criteria ask for ("physician+surgeon" → both). */
export function askedRoleClasses(criteria: SearchCriteria[]): string[] {
  const out: string[] = [];
  for (const c of criteria) {
    if (c.kind !== "role_class" || c.enforcement !== "hard") continue;
    const cls = (c.value as RoleClassValue | null)?.class ?? "";
    for (const k of cls.split("+")) {
      const key = k.trim();
      if (key && !out.includes(key)) out.push(key);
    }
  }
  return out;
}

/**
 * Patterns to apply for this ask. A multi-class ask only filters a pattern
 * when EVERY asked class treats it as noise — "surgeons and PAs" must keep
 * the PAs.
 */
export function noisePatternsFor(classes: readonly string[]): readonly RegExp[] {
  if (classes.length === 0) return [];
  const lists = classes.map((k) => ROLE_CLASS_NOISE[k]);
  if (lists.some((l) => !l || l.length === 0)) return [];
  const [first, ...rest] = lists as RegExp[][];
  return first.filter((p) => rest.every((l) => l.some((q) => q.source === p.source)));
}

/** Null when the row is clean; otherwise the evidence that excludes it. */
export function noiseVerdict(row: NoiseCheckRow, patterns: readonly RegExp[]): NoiseVerdict | null {
  if (patterns.length === 0) return null;
  const title = s(row.job_title);
  const headline = s(row.headline);
  for (const p of patterns) {
    const t = title.match(p);
    if (t) return { evidence: t[0], surface: "title" };
  }
  for (const p of patterns) {
    const h = headline.match(p);
    if (h) return { evidence: h[0], surface: "headline" };
  }
  return null;
}

export interface NoiseSplit<R> {
  clean: R[];
  noise: R[];
}

/**
 * Split card rows into clean and noise for the asked role classes. Noise
 * rows are annotated like grader rejects (verdict/reason/evidence/score 0)
 * so the UI path that reveals hidden rows needs no new shape.
 */
export function splitRoleClassNoise<R extends NoiseCheckRow & Record<string, unknown>>(
  rows: R[],
  criteria: SearchCriteria[],
): NoiseSplit<R> {
  const classes = askedRoleClasses(criteria);
  const patterns = noisePatternsFor(classes);
  if (patterns.length === 0) return { clean: rows, noise: [] };
  const label = classes.join("/");
  const clean: R[] = [];
  const noise: R[] = [];
  for (const row of rows) {
    const v = noiseVerdict(row, patterns);
    if (!v) {
      clean.push(row);
      continue;
    }
    const surfaceText = v.surface === "title" ? s(row.job_title) : s(row.headline);
    const annotated = row as Record<string, unknown>;
    annotated.audit_verdict = "reject";
    annotated.audit_score = 0;
    annotated.audit_reason = `Not a ${label}: ${v.surface} says "${v.evidence}".`;
    annotated.audit_evidence = surfaceText.slice(0, 140);
    annotated.noise_filtered = true;
    noise.push(row);
  }
  return { clean, noise };
}
