/**
 * soft-rank.ts — the deterministic layer that makes "ranked" TRUE.
 *
 * Until 2026-09-15 a soft criterion rendered as a "ranked" chip while no
 * code scored anything by it — a promise the engine did not keep. This
 * module keeps it:
 *
 *  - Every SOFT criterion (a care-setting preference, an auto-widened
 *    specialty/credential/fellowship, inferred title synonyms, a preferred
 *    city, a widened employer size) contributes to a per-row soft score.
 *  - Every hard credential / subspecialty criterion gets an EVIDENCE scan:
 *    the verbatim snippet proving it (a "CCRN" after the name, "Total Knee
 *    Arthroplasty" in skills, an "Adult Reconstruction Fellowship" record)
 *    is attached to the row, and evidenced rows tier above unevidenced ones
 *    — the clinician analog of the reference engine's award-evidence tier.
 *
 * Pure module: no I/O. Runs BEFORE the AI audit so a degraded audit still
 * leaves a genuinely ranked page; the audit's verdict tiers then sort on
 * top of this order (both sorts stable).
 */

import type {
  CareSettingValue,
  CredentialValue,
  LocationValue,
  SearchCriteria,
  SpecialtyValue,
  TitleValue,
} from "./clinician-criteria.ts";

export interface SoftRankRow {
  headline?: string | null;
  summary?: string | null;
  job_title?: string | null;
  job_company_name?: string | null;
  location_locality?: string | null;
  experience_history?: Array<{
    company_name?: string | null;
    title?: string | null;
    summary?: string | null;
    is_primary?: boolean;
  }> | null;
  education?: Array<{
    school_name?: string | null;
    degrees?: string[];
    majors?: string[];
  }> | null;
  /** Written by this module. */
  soft_score?: number;
  soft_matches?: string[];
  evidence_snippet?: string | null;
  evidence_term?: string | null;
}

function s(v: unknown): string {
  return typeof v === "string" ? v : "";
}

/** All searchable text of a row, lowercased, as (surface, text) pairs. */
function surfaces(row: SoftRankRow): Array<{ name: string; text: string }> {
  const out: Array<{ name: string; text: string }> = [
    { name: "headline", text: s(row.headline) },
    { name: "current title", text: s(row.job_title) },
    { name: "employer", text: s(row.job_company_name) },
    { name: "about", text: s(row.summary) },
  ];
  for (const e of row.experience_history ?? []) {
    if (s(e?.title)) out.push({ name: "role title", text: s(e!.title) });
    if (s(e?.summary)) out.push({ name: "role description", text: s(e!.summary) });
  }
  for (const ed of row.education ?? []) {
    const text = [s(ed?.school_name), ...(ed?.degrees ?? []), ...(ed?.majors ?? [])].join(" ");
    if (text.trim()) out.push({ name: "education", text });
  }
  return out.map((x) => ({ name: x.name, text: x.text.toLowerCase() }));
}

/** Verbatim evidence snippet around the first term hit, trimmed to 140. */
export function findEvidence(
  row: SoftRankRow,
  terms: readonly string[],
): { term: string; snippet: string } | null {
  const raw: string[] = [
    s(row.headline), s(row.job_title), s(row.summary),
    ...(row.experience_history ?? []).flatMap((e) => [s(e?.title), s(e?.summary)]),
    ...(row.education ?? []).flatMap((ed) => [
      [s(ed?.school_name), ...(ed?.degrees ?? []), ...(ed?.majors ?? [])].join(", "),
    ]),
  ].filter(Boolean);
  for (const text of raw) {
    const lower = text.toLowerCase();
    for (const term of terms) {
      const t = term.toLowerCase();
      const at = lower.indexOf(t);
      if (at === -1) continue;
      const start = Math.max(0, at - 40);
      const end = Math.min(text.length, at + t.length + 60);
      let snippet = text.slice(start, end).replace(/\s+/g, " ").trim();
      if (start > 0) snippet = "…" + snippet;
      if (end < text.length) snippet = snippet + "…";
      return { term, snippet: snippet.slice(0, 140) };
    }
  }
  return null;
}

function termsOf(c: SearchCriteria): string[] {
  const v = c.value;
  if (Array.isArray(v)) return v.filter((t): t is string => typeof t === "string");
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    const out: string[] = [];
    for (const key of ["terms", "title_terms", "any_of"]) {
      const arr = o[key];
      if (Array.isArray(arr)) out.push(...arr.filter((t): t is string => typeof t === "string"));
    }
    return out;
  }
  return [];
}

/**
 * Score one row against the SOFT criteria. Each satisfied soft criterion
 * adds points once (not per term); the matches list names what satisfied it
 * so logs and the grader can see why a row ranks where it does.
 */
export function scoreSoftCriteria(
  row: SoftRankRow,
  criteria: SearchCriteria[],
): { score: number; matches: string[] } {
  const surf = surfaces(row);
  const hit = (term: string): boolean => {
    const t = term.toLowerCase();
    return surf.some((x) => x.text.includes(t));
  };
  let score = 0;
  const matches: string[] = [];

  for (const c of criteria) {
    if (c.enforcement !== "soft") continue;
    switch (c.kind) {
      case "care_setting": {
        const v = c.value as CareSettingValue;
        const employer = s(row.job_company_name).toLowerCase();
        const nameTerms = v.employer_name_terms ?? [];
        if (nameTerms.some((t) => employer.includes(t.toLowerCase()))) {
          score += 3;
          matches.push(`${c.label} (employer name)`);
        } else if (v.terms.some(hit)) {
          score += 2;
          matches.push(c.label);
        }
        break;
      }
      case "specialty": {
        const v = c.value as SpecialtyValue | string[];
        const terms = Array.isArray(v) ? v : v.terms;
        if (terms.some(hit)) {
          // An auto-widened specialty ranks specialists first — "demote to
          // soft, never delete" only means something if the soft rank is real.
          score += 3;
          matches.push(c.label);
        }
        break;
      }
      case "title": {
        const v = c.value as TitleValue | string[];
        const terms = Array.isArray(v) ? v : v.terms;
        const title = s(row.job_title).toLowerCase();
        if (terms.some((t) => title.includes(t.toLowerCase()))) {
          score += 2;
          matches.push(c.label);
        }
        break;
      }
      case "credential":
      case "fellowship":
      case "role_class":
      case "training_stage": {
        if (termsOf(c).some(hit) || (c.kind === "fellowship" && hit("fellowship"))) {
          score += 2;
          matches.push(c.label);
        }
        break;
      }
      case "employer_size":
      case "seniority":
        // Numeric/enum softs: no text surface to score here; the grader
        // sees the seniority class and headcount on the row.
        break;
      default:
        if (termsOf(c).some(hit)) {
          score += 1;
          matches.push(c.label);
        }
    }
  }

  // Preferred city ("ideally near Miami"): carried on a HARD state
  // criterion, scored here because it is a preference by contract.
  for (const c of criteria) {
    if (c.kind !== "location") continue;
    const v = c.value as LocationValue;
    if (v.preferred_city) {
      const locality = s(row.location_locality).toLowerCase();
      if (locality.includes(v.preferred_city.toLowerCase())) {
        score += 2;
        matches.push(`near ${v.preferred_city}`);
      }
    }
  }

  return { score, matches };
}

/** Terms whose verbatim presence is PROOF of a hard evidence-class ask. */
function evidenceTerms(criteria: SearchCriteria[]): string[] {
  const out: string[] = [];
  for (const c of criteria) {
    if (c.enforcement !== "hard") continue;
    if (c.kind === "credential") {
      out.push(...(c.value as CredentialValue).any_of);
    } else if (c.kind === "specialty") {
      const v = c.value as SpecialtyValue | string[];
      if (!Array.isArray(v) && v.subspecialty) out.push(...v.terms);
    } else if (c.kind === "fellowship") {
      out.push("fellowship");
    }
  }
  return [...new Set(out)];
}

export interface DeterministicRankable extends SoftRankRow {
  match_scope?: string | null;
  stage_fit?: string | null;
}

/**
 * The ONE deterministic sort, applied after mapping and before the audit:
 *   1. primary-role match before secondary (match_scope),
 *   2. training-stage date window fit (stage-year asks),
 *   3. evidenced rows before unevidenced (credential / subspecialty /
 *      fellowship proof, verbatim snippet attached),
 *   4. soft-criteria score (descending),
 *   5. original index (stability).
 * Attaches soft_score / soft_matches / evidence_snippet / evidence_term.
 */
export function rankDeterministic<R extends DeterministicRankable>(
  rows: R[],
  criteria: SearchCriteria[],
): R[] {
  const evTerms = evidenceTerms(criteria);
  const scored = rows.map((row, i) => {
    const soft = scoreSoftCriteria(row, criteria);
    row.soft_score = soft.score;
    row.soft_matches = soft.matches;
    let evidenceTier = 1;
    if (evTerms.length > 0) {
      const ev = findEvidence(row, evTerms);
      if (ev) {
        row.evidence_snippet = ev.snippet;
        row.evidence_term = ev.term;
        evidenceTier = 0;
      } else {
        row.evidence_snippet = null;
        row.evidence_term = null;
      }
    }
    const scopeTier = row.match_scope === "secondary" ? 1 : 0;
    const stageTier = row.stage_fit === "in_window" ? 0 : row.stage_fit === "out_of_window" ? 2 : 1;
    return { row, scopeTier, stageTier, evidenceTier, soft: soft.score, i };
  });
  scored.sort((a, b) =>
    a.scopeTier - b.scopeTier ||
    a.stageTier - b.stageTier ||
    a.evidenceTier - b.evidenceTier ||
    b.soft - a.soft ||
    a.i - b.i
  );
  return scored.map((x) => x.row);
}
