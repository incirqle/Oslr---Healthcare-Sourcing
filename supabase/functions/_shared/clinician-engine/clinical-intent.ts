/**
 * Recruiter-language backstop for clinical intent.
 *
 * The AI parser remains the first reader. This deterministic layer protects
 * meaning that must never depend on a model getting a phrase exactly right:
 * non-operative exclusions, PGY ranges, and combined resident/fellow asks.
 * It runs for fresh, cached and Agent-supplied parses alike.
 */

const NON_OPERATIVE = /\b(?:non[\s-]?operative|non[\s-]?op(?:erative)?|non[\s-]?surgical|conservative(?:\s+(?:care|management|treatment))?)\b/i;
const NON_OPERATIVE_GLOBAL = /\b(?:non[\s-]?operative|non[\s-]?op(?:erative)?|non[\s-]?surgical|conservative(?:\s+(?:care|management|treatment))?)\b/gi;
const TRAINING_WORD = /\b(?:residents?|fellows?|pgy[\s-]*\d+)\b/i;

export const NON_OPERATIVE_INCLUDE_TERMS = [
  "non-operative orthopedic physician",
  "nonoperative orthopedic physician",
  "non-operative orthopedist",
  "nonoperative orthopedist",
  "non-surgical orthopedic physician",
  "nonsurgical orthopedic physician",
  "primary care sports medicine",
  "sports medicine physician",
  "pediatric sports medicine",
  "pediatric sports physician",
  "pediatric physiatrist",
  "pediatric rehabilitation medicine",
  "physiatrist",
  "physical medicine and rehabilitation",
  "interventional spine physician",
  "non-operative spine physician",
  "nonoperative spine physician",
  "pain medicine physician",
] as const;

function strings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((x): x is string => typeof x === "string")
    .map((x) => x.toLowerCase().trim()).filter(Boolean);
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function has(query: string, pattern: RegExp): boolean {
  return pattern.test(query);
}

export function isNonOperativeQuery(query: string): boolean {
  return NON_OPERATIVE.test(query);
}

/** Every year in forms such as PGY-4/5, PGY4 and PGY5, or PGY-4, PGY-5. */
export function pgyYears(query: string): number[] {
  const years = new Set<number>();
  const expressions = query.match(/\bpgy[\s-]*(?:level[\s-]*)?\d+(?:\s*(?:,|and|or|\/|&)\s*(?:pgy[\s-]*)?\d+)*/gi) ?? [];
  for (const expression of expressions) {
    for (const match of expression.matchAll(/\d+/g)) {
      const year = Number(match[0]);
      if (year >= 1 && year <= 10) years.add(year);
    }
  }
  return [...years].sort((a, b) => a - b);
}

function trainingProfessions(query: string): string[] {
  const out: string[] = [];
  if (/\b(?:orthopedic|orthopaedic|ortho)\b/i.test(query)) out.push("orthopedic surgery");
  if (/\b(?:neurosurgery|neurosurgical|neurological surgery)\b/i.test(query)) out.push("neurosurgery");
  if (/\b(?:pm&r|pmr|physiatry|physical medicine and rehabilitation)\b/i.test(query)) out.push("physical medicine and rehabilitation");
  if (out.length === 0 && /\b(?:spine|spinal|scoliosis)\b/i.test(query)) {
    // Spine training is spread across these parent programs. The subspecialty
    // remains a separate hard requirement, so this broadens the right track,
    // not the clinical focus.
    out.push("orthopedic surgery", "neurosurgery", "physical medicine and rehabilitation");
  }
  if (out.length === 0 && /\b(?:pediatric|paediatric|peds)\b/i.test(query)) out.push("pediatrics");
  if (out.length === 0 && /\b(?:podiatry|podiatric)\b/i.test(query)) out.push("podiatric");
  return out;
}

/**
 * Normalize the raw recruiter sentence without discarding unrelated parsed
 * requirements. Only explicit phrases trigger these corrections.
 */
export function normalizeClinicalIntent(
  input: Record<string, unknown>,
  originalQuery: string,
): Record<string, unknown> {
  const parsed: Record<string, unknown> = { ...input };
  const query = originalQuery.trim();

  if (isNonOperativeQuery(query)) {
    const specialties = unique([
      ...(typeof parsed.specialty === "string" ? [parsed.specialty.toLowerCase()] : []),
      ...strings(parsed.specialties),
    ]).filter((term) => !NON_OPERATIVE.test(term));
    // A compound such as "pediatric orthopedic" already carries the
    // population. Bare "pediatrics" beside it re-admits general pediatricians.
    const hasPediatricCompound = specialties.some((term) => /\b(?:pediatric|paediatric)\s+\S+/.test(term));
    if (hasPediatricCompound) {
      for (let i = specialties.length - 1; i >= 0; i--) {
        if (["pediatric", "pediatrics", "paediatric", "paediatrics", "peds"].includes(specialties[i])) specialties.splice(i, 1);
      }
    }
    if (/\b(?:pediatric|paediatric|peds)\b/i.test(query)) {
      if (!specialties.some((term) => /pediatric|paediatric/.test(term))) specialties.unshift("pediatric orthopedic");
      specialties.push("pediatric sports medicine", "pediatric rehabilitation medicine");
    }
    if (/\b(?:spine|spinal|scoliosis)\b/i.test(query)) specialties.push("spine");
    parsed.specialty = specialties[0] ?? null;
    parsed.specialties = unique(specialties);
    parsed.required_keywords = strings(parsed.required_keywords).filter((term) => !NON_OPERATIVE.test(term));
    parsed.keywords = strings(parsed.keywords).filter((term) => !NON_OPERATIVE.test(term));
    parsed.role_class = "physician";
    parsed.role_classes = strings(parsed.role_classes).filter((role) => role !== "surgeon");
    parsed.job_titles = [];
    parsed.title_synonyms = [];
    parsed.current_role_only = true;
    parsed.practice_modality = {
      mode: "nonoperative",
      include_terms: [...NON_OPERATIVE_INCLUDE_TERMS],
      exclude_terms: ["surgeon", "surgery", "surgical", "operative"],
    };
  }

  if (TRAINING_WORD.test(query)) {
    const years = pgyYears(query);
    const previous = parsed.training_stage && typeof parsed.training_stage === "object" && !Array.isArray(parsed.training_stage)
      ? parsed.training_stage as Record<string, unknown>
      : {};
    const wantsResidency = years.length > 0 || /\bresidents?\b/i.test(query);
    const wantsFellowship = /\bfellows?\b/i.test(query);
    const stages = wantsResidency && wantsFellowship ? ["residency", "fellowship"]
      : wantsFellowship ? ["fellowship"]
      : [typeof previous.stage === "string" ? previous.stage : "residency"];
    const professions = trainingProfessions(query);
    const previousProfession = typeof previous.profession === "string" ? previous.profession.toLowerCase() : null;
    const resolvedProfessions = professions.length > 0 ? professions : previousProfession ? [previousProfession] : [];
    parsed.training_stage = {
      profession: resolvedProfessions[0] ?? null,
      professions: resolvedProfessions,
      stage: stages[0],
      stages,
      year: years.length === 1 ? years[0] : null,
      years,
    };
    if (stages.length === 2) {
      parsed.role_class = null;
      parsed.role_classes = ["resident", "fellow"];
    } else {
      parsed.role_class = stages[0] === "fellowship" ? "fellow" : "resident";
      parsed.role_classes = [];
    }
    parsed.job_titles = [];
    parsed.title_synonyms = [];
    if (/\b(?:spine|spinal|scoliosis)\b/i.test(query)) {
      const specialties = unique([
        ...(typeof parsed.specialty === "string" ? [parsed.specialty.toLowerCase()] : []),
        ...strings(parsed.specialties),
        "spine",
      ]).filter((term) => !/^pgy/i.test(term));
      parsed.specialty = specialties[0] ?? "spine";
      parsed.specialties = specialties;
    }
    parsed.required_keywords = strings(parsed.required_keywords).filter((term) => !/\bpgy\b/i.test(term));
  }

  return parsed;
}

export interface NonOperativeRow {
  job_title?: unknown;
  headline?: unknown;
  audit_verdict?: unknown;
  audit_score?: unknown;
  audit_reason?: unknown;
  audit_evidence?: unknown;
  modality_filtered?: unknown;
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/**
 * Remove explicit operative identities only. A profile that says
 * "non-operative" on the same surface stays, even if it also discusses surgery.
 */
export function splitNonoperativeRows<R extends NonOperativeRow>(rows: R[]): { clean: R[]; rejected: R[] } {
  const clean: R[] = [];
  const rejected: R[] = [];
  for (const row of rows) {
    const surfaces = [text(row.job_title), text(row.headline)];
    const operative = surfaces.find((surface) =>
      !NON_OPERATIVE.test(surface) && /\b(?:surgeons?|surgery|surgical|operative)\b/i.test(surface)
    );
    if (!operative) {
      clean.push(row);
      continue;
    }
    row.audit_verdict = "reject";
    row.audit_score = 0;
    row.audit_reason = `The search requires non-operative care, but this profile says "${operative.slice(0, 100)}".`;
    row.audit_evidence = operative.slice(0, 140);
    row.modality_filtered = true;
    rejected.push(row);
  }
  return { clean, rejected };
}

/** Test helper: no modality phrase should leak back in as a specialty. */
export function modalityTermsRemoved(query: string): string[] {
  return query.toLowerCase().split(NON_OPERATIVE_GLOBAL).filter(Boolean);
}
