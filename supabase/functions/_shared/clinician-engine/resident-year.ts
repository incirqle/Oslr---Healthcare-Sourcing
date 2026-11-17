/**
 * Resident-year searches (a "PGY-4 / PGY-5 residents" ask). Residents and
 * fellows are different roles: a resident-year ask never serves a current
 * fellow, and never serves a clear junior (written PGY outside the ask, or a
 * residency start too recent for the asked year). Written PGY beats dates;
 * start dates are a guide with room for research years. Undated residents
 * are set aside, not shown. Pure module: no provider calls, no I/O.
 */
import type { SearchCriteria, TrainingStageValue } from "./clinician-criteria.ts";

type Row = Record<string, unknown>;

export type ResidentYearStatus = "stated" | "chief" | "dated" | "undated" | "fellow" | "junior" | "stale" | "other_year" | "not_resident";

export interface ResidentYearAssessment {
  status: ResidentYearStatus;
  /** 0 = written PGY or chief, 1 = date estimate; null when not kept. */
  tier: 0 | 1 | null;
  reason: string | null;
}

/** Research-year allowance: a PGY-N may have started up to this many years early. */
export const RESEARCH_YEAR_SLACK = 2;

function text(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}
function rows(v: unknown): Row[] {
  return Array.isArray(v) ? v.filter((x): x is Row => !!x && typeof x === "object" && !Array.isArray(x)) : [];
}
function company(e: Row): string {
  return text(e.company_name ?? e.name ?? e.company);
}

const RESIDENT = /\b(?:resident|residency|house\s*staff|house\s+officer|pgy[\s-]*\d)\b/i;
const NON_PHYSICIAN_RESIDENT = /\b(?:resident\s+(?:advisor|assistant)|pharmacy\s+resident|pharmacist|physical\s+therap|nurse|nursing|dental)\b/i;
const FELLOW = /\bfellow(?:ship)?\b/i;
const NOT_A_FELLOW_ROLE = /\b(?:research\s+fellow|incoming|applying|matched|future|aspiring)\b/i;
/** Residency titles that name a different specialty or license. */
const OTHER_SPECIALTY: Array<[RegExp, RegExp]> = [
  [/\borthop/i, /\b(?:emergency|internal\s+medicine|urolog|radiolog|pediatric\s+resident|psychiatr|neurolog|anesthesi|dermatolog|ophthalmolog|otolaryngolog|obstetric|gynecolog|family\s+medicine|general\s+surgery|plastic\s+surgery|neurosurg|pathology|cardiolog|physician\s+assistant|\bpa[-\s]?c\b|podiatr|administrative\s+chief)/i],
];
const FORMER = /\b(?:former|previous|prior|completed|graduated|alumn(?:us|a))\b/i;

/** July 1 academic year containing `now` (2026-11 → 2026). */
export function academicYear(now: Date): number {
  return now.getUTCMonth() >= 6 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
}

/** Academic year a role started (programs start late June/July; May counts as that year). */
function startAcademicYear(raw: string): number | null {
  const m = raw.match(/^(\d{4})(?:-(\d{1,2}))?/);
  if (!m) return null;
  const year = Number(m[1]);
  const month = m[2] ? Number(m[2]) : 7;
  return month >= 5 ? year : year - 1;
}

export function statedPgy(value: string): number[] {
  const out = new Set<number>();
  for (const expr of value.match(/\bpgy[\s-]*(?:level[\s-]*)?\d+(?:\s*(?:,|and|or|\/|&)\s*(?:pgy[\s-]*)?\d+)*/gi) ?? []) {
    for (const d of expr.matchAll(/\d+/g)) {
      const n = Number(d[0]);
      if (n >= 1 && n <= 10) out.add(n);
    }
  }
  return [...out];
}

function currentRoles(row: Row): Row[] {
  const cur = rows(row.current_employers);
  if (cur.length > 0) return cur;
  return rows(row.experience_history).filter((e) => e.is_current === true || e.is_primary === true);
}

function isResidentRole(e: Row): boolean {
  const title = text(e.title);
  if (!title || FORMER.test(title) || NON_PHYSICIAN_RESIDENT.test(title)) return false;
  return RESIDENT.test(title);
}

function isFellowRole(e: Row): boolean {
  const title = text(e.title);
  if (!title || FORMER.test(title)) return false;
  if (!FELLOW.test(title) || NOT_A_FELLOW_ROLE.test(title)) return false;
  // "Orthopaedic Surgery Resident Research Fellow" is a resident.
  return !RESIDENT.test(title);
}

/** True when the request is a resident-year ask (years set, fellowship not asked). */
export function residentYearStage(criteria: SearchCriteria[]): TrainingStageValue | null {
  const c = criteria.find((x) => x.kind === "training_stage" && x.enforcement === "hard");
  const v = c?.value as TrainingStageValue | undefined;
  if (!v) return null;
  const years = v.years?.length ? v.years : v.year ? [v.year] : [];
  const stages = v.stages?.length ? v.stages : [v.stage];
  if (years.length === 0 || !stages.includes("residency") || stages.includes("fellowship")) return null;
  return { ...v, years };
}

export function assessResidentYear(row: Row, stage: TrainingStageValue, now: Date = new Date()): ResidentYearAssessment {
  const years = stage.years?.length ? stage.years : stage.year ? [stage.year] : [];
  const current = currentRoles(row);
  const residentRoles = current.filter(isResidentRole);
  const fellowRoles = current.filter(isFellowRole);
  const startOf = (e: Row) => startAcademicYear(text(e.start_date)) ?? -Infinity;
  const newestResident = residentRoles.reduce((m, e) => Math.max(m, startOf(e)), -Infinity);
  const newestFellow = fellowRoles.reduce((m, e) => Math.max(m, startOf(e)), -Infinity);

  if (fellowRoles.length > 0 && (residentRoles.length === 0 || newestFellow > newestResident)) {
    return { status: "fellow", tier: null, reason: "Current fellow, not a resident" };
  }
  const professions = [...(stage.professions ?? []), stage.profession ?? ""].join(" ");
  const rule = OTHER_SPECIALTY.find(([prof]) => prof.test(professions));
  if (rule && residentRoles.length > 0 && residentRoles.every((e) => rule[1].test(text(e.title)) && !rule[0].test(text(e.title)))) {
    return { status: "not_resident", tier: null, reason: `${text(residentRoles[0].title)} is a different specialty` };
  }
  // A generic "Resident Physician" at a large hospital is not necessarily an
  // orthopedic resident. Require orthopedic wording on the person's own role,
  // headline, summary, or specialty-named employer; hospital reputation alone
  // is not evidence. This keeps generic-but-explicit profiles without padding
  // the result with unsupported specialties.
  if (/orthop/i.test(professions) && residentRoles.length > 0) {
    const orthopedicEvidence = [
      text(row.headline), text(row.summary),
      ...residentRoles.flatMap((e) => [text(e.title), text(e.description), text(e.summary), text(e.name)]),
    ].join(" ");
    if (!/orthop/i.test(orthopedicEvidence)) {
      return { status: "not_resident", tier: null, reason: "No orthopedic evidence for this generic resident role" };
    }
  }
  if (residentRoles.length === 0) {
    const headline = text(row.headline);
    if (!RESIDENT.test(headline) || FELLOW.test(headline.replace(NOT_A_FELLOW_ROLE, ""))) {
      return { status: "not_resident", tier: null, reason: "No current residency role is listed" };
    }
  }

  const stated = new Set<number>();
  const surfaces = [
    text(row.headline), text(row.summary),
    ...residentRoles.flatMap((e) => [text(e.title), text(e.description), text(e.summary)]),
  ];
  for (const s of surfaces) for (const y of statedPgy(s)) stated.add(y);
  const hit = [...stated].find((y) => years.includes(y));
  if (hit !== undefined) return { status: "stated", tier: 0, reason: `States PGY-${hit}` };
  if (stated.size > 0) {
    return { status: "other_year", tier: null, reason: `Profile states ${[...stated].map((y) => `PGY-${y}`).join(" / ")}, not ${years.map((y) => `PGY-${y}`).join(" / ")}` };
  }

  const maxYear = Math.max(...years);
  if (residentRoles.some((e) => /\bchief\s+resident\b/i.test(text(e.title))) && maxYear >= 5) {
    return { status: "chief", tier: 0, reason: "Chief resident (final year)" };
  }

  // A research-year entry ("Resident Research Fellow") starts mid-residency;
  // the residency itself dates the training year.
  const mainRoles = residentRoles.filter((e) => !/\bresearch\b/i.test(text(e.title)));
  const dated = (mainRoles.length > 0 ? mainRoles : residentRoles).map(startOf).filter((y) => Number.isFinite(y));
  if (dated.length === 0) return { status: "undated", tier: null, reason: "Training year not listed" };
  const start = Math.max(...dated);
  const ay = academicYear(now);
  const latestStart = ay - (Math.min(...years) - 1);
  const earliestStart = ay - (maxYear - 1) - RESEARCH_YEAR_SLACK;
  if (start > latestStart) {
    const pgy = ay - start + 1;
    return { status: "junior", tier: null, reason: `Residency started ${start}, about PGY-${Math.max(1, pgy)}` };
  }
  if (start < earliestStart) {
    return { status: "stale", tier: null, reason: `Residency listed as started ${start}; too long ago to still be in residency` };
  }
  return { status: "dated", tier: 1, reason: `Residency started ${start}` };
}

/** Keep only PGY-in-ask residents; everything else leaves with its reason. */
export function splitResidentYearRows<R extends Row>(input: R[], criteria: SearchCriteria[], now: Date = new Date()): { clean: R[]; rejected: R[] } {
  const stage = residentYearStage(criteria);
  if (!stage) return { clean: input, rejected: [] };
  const clean: R[] = [];
  const rejected: R[] = [];
  for (const row of input) {
    const a = assessResidentYear(row, stage, now);
    (row as Row).resident_year_status = a.status;
    if (a.tier !== null) {
      (row as Row).resident_year_tier = a.tier;
      clean.push(row);
    } else {
      (row as Row).audit_verdict = "reject";
      (row as Row).audit_score = 0;
      (row as Row).audit_reason = a.reason;
      (row as Row).training_filtered = true;
      rejected.push(row);
    }
  }
  return { clean, rejected };
}

/** Stable: written PGY / chief first, then date estimates. */
export function sortByResidentYearTier<R extends Row>(input: R[]): R[] {
  return input
    .map((r, i) => ({ r, i, t: typeof r.resident_year_tier === "number" ? r.resident_year_tier as number : 2 }))
    .sort((a, b) => a.t - b.t || a.i - b.i)
    .map(({ r }) => r);
}

/**
 * Residency programs searched by name for a resident ask in their metro,
 * alongside the city search: residents often list no city or an old one.
 */
const PROGRAMS: Array<{ city: RegExp; specialty: RegExp; state: string; variants: string[]; programs: string[][] }> = [
  {
    city: /^(?:new york(?: city)?|nyc|manhattan|brooklyn|bronx|the bronx|queens)$/i,
    specialty: /orthop/i,
    state: "new york",
    variants: [
      "nyu langone", "nyu grossman", "hospital for joint diseases",
      "hospital for special surgery", "weill cornell",
      "mount sinai", "icahn school of medicine",
      "montefiore", "albert einstein college of medicine",
      "columbia university irving", "newyork-presbyterian", "new york-presbyterian", "columbia orthopedics",
      "suny downstate", "downstate health sciences", "kings county hospital",
      "maimonides",
      "lenox hill",
      "one brooklyn health", "kingsbrook",
    ],
    // One fair pass per residency program. A single OR across every hospital
    // lets the largest program consume the whole credit budget.
    programs: [
      ["nyu langone", "nyu grossman", "hospital for joint diseases"],
      ["hospital for special surgery", "weill cornell"],
      ["mount sinai", "icahn school of medicine"],
      ["montefiore", "albert einstein college of medicine"],
      ["columbia university irving", "newyork-presbyterian", "new york-presbyterian", "columbia orthopedics"],
      ["suny downstate", "downstate health sciences", "kings county hospital"],
      ["maimonides"],
      ["lenox hill"],
      ["one brooklyn health", "kingsbrook"],
    ],
  },
];

export function residencyProgramRecall(criteria: SearchCriteria[]): { state: string; variants: string[]; programs: string[][] } | null {
  const stage = residentYearStage(criteria);
  if (!stage) return null;
  const professions = [...(stage.professions ?? []), stage.profession ?? ""].join(" ");
  const loc = criteria.find((c) => c.kind === "location" && c.enforcement === "hard")?.value as { city?: string; state?: string } | undefined;
  const city = text(loc?.city);
  if (!city) return null;
  const p = PROGRAMS.find((x) => x.city.test(city) && x.specialty.test(professions));
  return p ? { state: p.state, variants: p.variants, programs: p.programs } : null;
}
