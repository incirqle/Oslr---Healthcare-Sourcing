/**
 * ranking-criteria.ts: per-candidate, per-criterion results and the match
 * rate (docs/oslr-criteria-ranking-spec.md sections 3, 4, 7, 8).
 *
 * Pure: no I/O. The handler calls the resolvers before the grader so the
 * grader is only asked about criteria a rule could not decide, then merges
 * the grader's per-criterion answers, scores every row and sets aside rows
 * that fail a must-have.
 */

import type {
  CareSettingValue,
  CompanyValue,
  CredentialValue,
  CriterionKind,
  EmployerGroupValue,
  EmployerSizeValue,
  EmploymentModelValue,
  ExperienceValue,
  LocationValue,
  SearchCriteria,
  SpecialtyValue,
  TenureValue,
} from "./clinician-criteria.ts";

/* ------------------------------------------------------------------ */
/*  Types (spec 3.1, 3.2)                                              */
/* ------------------------------------------------------------------ */

export type RankingOrigin = "parsed" | "user" | "suggested";

export interface RankingCriterion {
  /** Stable id. For parsed soft criteria reuse SearchCriteria.id ("c4"). User-added: "u" + nanoid(8). */
  id: string;
  /** Full text as the user would read it. */
  text: string;
  /** 1-2 word column label ("Fellowship", "Robotic"). Generated once, editable. */
  title: string;
  /** 0 = most important. Array order is the source of truth; this mirrors it. */
  position: number;
  must_have: boolean;
  origin: RankingOrigin;
  /** Set when the criterion maps to an engine kind with a deterministic resolver (section 4). */
  kind?: CriterionKind;
  /** The SearchCriteria it came from, when origin === "parsed". */
  source_criterion_id?: string;
}

export type CriterionStatus = "met" | "partial" | "unknown" | "not_met";
export type ResultSource = "rule" | "grader";

export interface CriterionResult {
  criterion_id: string;
  status: CriterionStatus;
  source: ResultSource;
  evidence: string | null;
  section: string | null;
  explanation: string | null;
}

/** What the grader returns per criterion (parseAuditVerdicts output). */
export interface GraderCriterionResult {
  criterion_id: string;
  status: CriterionStatus;
  evidence: string | null;
  section: string | null;
}

export interface MatchBreakdownEntry {
  criterion_id: string;
  points: number;
  max: number;
}

export const RANKING_VERSION = 1 as const;
export const EVIDENCE_MAX = 160;

/* ------------------------------------------------------------------ */
/*  Scoring (spec 7)                                                   */
/* ------------------------------------------------------------------ */

export const STATUS_CREDIT: Record<CriterionStatus, number> = {
  met: 1, partial: 0.5, unknown: 0.25, not_met: 0,
};

/** Weight of the criterion at position i of n. Linear, visible in the UI. */
export function weightAt(i: number, n: number): number {
  return n - i; // n=4 -> 4,3,2,1 (40%, 30%, 20%, 10%)
}

export function scoreRow(results: CriterionResult[], ranking: RankingCriterion[]): {
  match_rate: number | null;
  breakdown: MatchBreakdownEntry[];
  must_have_failed: string[];
} {
  const n = ranking.length;
  if (n === 0) return { match_rate: null, breakdown: [], must_have_failed: [] };
  const byId = new Map(results.map((r) => [r.criterion_id, r]));
  let got = 0, max = 0;
  const breakdown: MatchBreakdownEntry[] = [];
  const must_have_failed: string[] = [];
  ranking.forEach((c, i) => {
    const w = weightAt(i, n);
    const status = byId.get(c.id)?.status ?? "unknown";
    const pts = w * STATUS_CREDIT[status];
    got += pts;
    max += w;
    breakdown.push({ criterion_id: c.id, points: pts, max: w });
    if (c.must_have && status === "not_met") must_have_failed.push(c.id);
  });
  return { match_rate: Math.round((got / max) * 100), breakdown, must_have_failed };
}

/* ------------------------------------------------------------------ */
/*  Criteria from the parse (spec 3.3, 6.3)                            */
/* ------------------------------------------------------------------ */

/** Fallback short title: first phrase of the text, title-cased, max 14 characters. */
export function shortTitle(text: string): string {
  const first = String(text ?? "").split(/[,;:(]| - | and | with | in | at /i)[0].trim() || String(text ?? "").trim();
  const tc = first.toLowerCase().replace(/\b[a-z]/g, (ch) => ch.toUpperCase());
  if (tc.length <= 14) return tc;
  const words = tc.split(/\s+/);
  let out = "";
  for (const w of words) {
    const next = out ? `${out} ${w}` : w;
    if (next.length > 14) break;
    out = next;
  }
  return out || tc.slice(0, 14);
}

/** Parsed soft criteria become the initial ranking, in parse order. */
export function rankingFromCriteria(criteria: SearchCriteria[]): RankingCriterion[] {
  return criteria
    .filter((c) => c.enforcement === "soft")
    .map((c, position) => ({
      id: c.id,
      text: c.label,
      title: shortTitle(c.label),
      position,
      must_have: false,
      origin: "parsed" as const,
      kind: c.kind,
      source_criterion_id: c.id,
    }));
}

export function splitCriteria(criteria: SearchCriteria[]): {
  required: SearchCriteria[];
  ranking: RankingCriterion[];
  cant_check: SearchCriteria[];
} {
  return {
    required: criteria.filter((c) => c.enforcement === "hard"),
    ranking: rankingFromCriteria(criteria),
    cant_check: criteria.filter((c) => c.enforcement === "dropped"),
  };
}

/* ------------------------------------------------------------------ */
/*  Deterministic resolvers (spec 4)                                   */
/* ------------------------------------------------------------------ */

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;

const low = (v: unknown) => (typeof v === "string" ? v.toLowerCase().trim() : "");
const clip = (s: string) => (s.length > EVIDENCE_MAX ? s.slice(0, EVIDENCE_MAX - 3) + "..." : s);
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function monthLabel(iso: unknown): string {
  const m = typeof iso === "string" ? iso.match(/^(\d{4})-(\d{2})/) : null;
  return m ? `${MONTHS[Number(m[2]) - 1]} ${m[1]}` : String(iso ?? "");
}
function yearsSince(iso: unknown, now: number): number | null {
  if (typeof iso !== "string" || !iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? (now - t) / (365.25 * 86_400_000) : null;
}

function rule(criterion_id: string, status: CriterionStatus, evidence: string | null, section: string | null = null): CriterionResult {
  return { criterion_id, status, source: "rule", evidence: evidence ? clip(evidence) : null, section, explanation: null };
}

function inRange(x: number, v: { min?: number; max?: number }): "in" | "near" | "out" {
  const min = typeof v.min === "number" ? v.min : -Infinity;
  const max = typeof v.max === "number" ? v.max : Infinity;
  if (x >= min && x <= max) return "in";
  if (x >= min - 1 && x <= max + 1) return "near";
  return "out";
}

function currentEmployers(row: Row): Row[] {
  return Array.isArray(row.current_employers) ? row.current_employers : [];
}

function nameMatches(name: string, wanted: string[]): boolean {
  const n = low(name);
  if (!n) return false;
  return wanted.some((w) => {
    const x = low(w);
    return !!x && (n === x || n.includes(x) || x.includes(n));
  });
}

/**
 * One resolver per kind. Returns null when a rule cannot decide (the
 * grader is asked instead). `id` is the result's criterion_id (a
 * RankingCriterion id or a SearchCriteria id).
 */
export function resolveCriterion(c: SearchCriteria, row: Row, id: string = c.id, now: number = Date.now()): CriterionResult | null {
  switch (c.kind) {
    case "location": {
      const v = c.value as LocationValue | null;
      const city = low(row.location_locality);
      const region = low(row.location_region);
      if (!city && !region) return null;
      const where = [row.location_locality, row.location_region].filter(Boolean).join(", ");
      const states = [...(v?.states ?? []), ...(v?.state ? [v.state] : [])].map(low).filter(Boolean);
      const cityHit = !!v?.city && city === low(v.city);
      const stateHit = states.length > 0 && states.includes(region);
      const countryHit = v?.level === "country" && !!v.country && region !== "" ;
      if (cityHit || stateHit || countryHit) return rule(id, "met", `Located in ${where}`, "location");
      if (row.location_note) return rule(id, "partial", String(row.location_note), "location");
      return rule(id, "not_met", `Located in ${where}`, "location");
    }
    case "company":
    case "employer_group": {
      const v = c.value as CompanyValue | EmployerGroupValue | null;
      if (!v) return null;
      const wanted = [v.name, ...("name_variants" in v ? v.name_variants ?? [] : [])].filter(Boolean) as string[];
      const ids = "company_ids" in v ? new Set(v.company_ids ?? []) : new Set<number>();
      if ("company_id" in v && typeof v.company_id === "number") ids.add(v.company_id);
      const emps = currentEmployers(row);
      const hit = (e: Row) => (typeof e.company_id === "number" && ids.has(e.company_id)) || nameMatches(String(e.name ?? ""), wanted);
      const primaryIdx = emps.findIndex((e) => e.is_primary === true);
      if (nameMatches(String(row.job_company_name ?? ""), wanted) || (primaryIdx >= 0 && hit(emps[primaryIdx]))) {
        return rule(id, "met", `Current: ${row.job_company_name ?? emps[primaryIdx]?.name}`, `cur0`);
      }
      const other = emps.findIndex((e, i) => i !== primaryIdx && hit(e));
      if (other >= 0) return rule(id, "partial", `Also at ${emps[other].name}`, `cur${other}`);
      return null;
    }
    case "role_class": {
      if (row.match_scope === "primary") return rule(id, "met", row.job_title ? `Primary role: ${row.job_title}` : "Primary role", "cur0");
      if (row.match_scope === "secondary") return rule(id, "partial", "Matched on a side role, not the primary one", null);
      return null;
    }
    case "training_stage": {
      const start = row.job_start_date ? `Started ${monthLabel(row.job_start_date)}` : "Start date";
      if (row.stage_fit === "in_window") return rule(id, "met", `${start}, fits the asked training year`, "cur0");
      if (row.stage_fit === "out_of_window") return rule(id, "not_met", `${start}, outside the asked training year`, "cur0");
      return null;
    }
    case "specialty": {
      const v = c.value as SpecialtyValue | string[] | null;
      if (!v || Array.isArray(v) || !v.subspecialty) return null;
      const snippet = typeof row.evidence_snippet === "string" ? row.evidence_snippet : "";
      if (!snippet) return null;
      const terms = [v.subspecialty.label, v.subspecialty.key, ...(v.subspecialty.education_terms ?? []), ...(v.terms ?? [])].map(low).filter(Boolean);
      const term = low(row.evidence_term);
      const hit = (term && terms.some((t) => t.includes(term) || term.includes(t))) || terms.some((t) => low(snippet).includes(t));
      return hit ? rule(id, "met", snippet, null) : null;
    }
    case "credential": {
      const v = c.value as CredentialValue | null;
      const snippet = typeof row.evidence_snippet === "string" ? row.evidence_snippet : "";
      if (!v || !snippet) return null;
      const term = low(row.evidence_term);
      const any = (v.any_of ?? []).map(low);
      const hit = (term && any.includes(term)) || any.some((a) => a && new RegExp(`\\b${a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(snippet));
      return hit ? rule(id, "met", snippet, null) : null;
    }
    case "fellowship": {
      const edu: Row[] = Array.isArray(row.education) ? row.education : [];
      const ei = edu.findIndex((e) => /fellow/i.test([e.school_name, ...(e.degrees ?? []), ...(e.majors ?? [])].filter(Boolean).join(" ")));
      if (ei >= 0) {
        const e = edu[ei];
        return rule(id, "met", [...(e.degrees ?? []), ...(e.majors ?? []), e.school_name].filter(Boolean).join(", "), `edu${ei}`);
      }
      const past: Row[] = (Array.isArray(row.experience_history) ? row.experience_history : []).filter((e: Row) => e && e.is_primary !== true);
      const pi = past.findIndex((e) => /\bfellow(ship)?\b/i.test(String(e.title ?? "")));
      if (pi >= 0) return rule(id, "met", `${past[pi].title} @ ${past[pi].company_name}`, `exp${pi}`);
      return null;
    }
    case "employment_model": {
      const v = c.value as EmploymentModelValue | null;
      const read = row.employment_model;
      if (!v || !read || read === "unknown") return null;
      const evidence = `employment model: ${read}${row.employment_model_evidence ? ` (${row.employment_model_evidence})` : ""}`;
      return rule(id, read === v.model ? "met" : "not_met", evidence, "cur0");
    }
    case "experience": {
      const v = c.value as ExperienceValue | null;
      const starts = (Array.isArray(row.experience_history) ? row.experience_history : [])
        .map((e: Row) => (typeof e?.start_date === "string" ? Date.parse(e.start_date) : NaN))
        .filter((t: number) => Number.isFinite(t));
      if (!v || starts.length === 0) return null;
      const earliest = Math.min(...starts);
      const years = (now - earliest) / (365.25 * 86_400_000);
      const fit = inRange(years, v);
      const evidence = `${Math.floor(years)} years since the first listed role (${monthLabel(new Date(earliest).toISOString())})`;
      return rule(id, fit === "in" ? "met" : fit === "near" ? "partial" : "not_met", evidence, null);
    }
    case "tenure": {
      const v = c.value as TenureValue | null;
      const years = yearsSince(row.job_start_date, now);
      if (!v || years === null) return null;
      const fit = inRange(years, v);
      return rule(id, fit === "in" ? "met" : fit === "near" ? "partial" : "not_met", `In the current role since ${monthLabel(row.job_start_date)}`, "cur0");
    }
    case "employer_size": {
      const v = c.value as EmployerSizeValue | null;
      const emps = currentEmployers(row);
      const primary = emps.find((e) => e.is_primary === true) ?? emps[0];
      const hc = typeof primary?.headcount === "number" ? primary.headcount : null;
      if (!v || !hc) return null;
      const ok = (v.min_headcount === undefined || hc >= v.min_headcount) && (v.max_headcount === undefined || hc <= v.max_headcount);
      return rule(id, ok ? "met" : "not_met", `${primary.name ?? "Current employer"}: ${hc} employees`, "cur0");
    }
    case "care_setting": {
      const v = c.value as CareSettingValue | null;
      if (!v) return null;
      const nameTerms = (v.employer_name_terms?.length ? v.employer_name_terms : v.terms ?? []).map(low).filter(Boolean);
      const employer = low(row.job_company_name);
      const nameHit = nameTerms.find((t) => employer.includes(t));
      if (nameHit) return rule(id, "met", `Current employer: ${row.job_company_name}`, "cur0");
      const emps = currentEmployers(row);
      const primary = emps.find((e) => e.is_primary === true) ?? emps[0];
      const roleText = low([row.job_title, primary?.summary].filter(Boolean).join(" "));
      const roleHit = (v.terms ?? []).map(low).find((t) => t && roleText.includes(t));
      if (roleHit) return rule(id, "partial", `Role text mentions "${roleHit}"`, "cur0");
      return null;
    }
    default:
      return null;
  }
}

/** Resolve a ranking criterion against a row, using its source SearchCriteria when it has one. */
export function resolveRanking(rc: RankingCriterion, byId: Map<string, SearchCriteria>, row: Row, now?: number): CriterionResult | null {
  const src = rc.source_criterion_id ? byId.get(rc.source_criterion_id) : undefined;
  return src ? resolveCriterion(src, row, rc.id, now) : null;
}

/* ------------------------------------------------------------------ */
/*  Merge, score, set aside (spec 3.2, 7, 8)                           */
/* ------------------------------------------------------------------ */

/**
 * The full criteria_results for one row: Required first (met on kept rows,
 * never re-judged), then Preferred in ranking order (rule, else grader,
 * else unknown).
 */
export function buildCriteriaResults(
  row: Row,
  required: SearchCriteria[],
  ranking: RankingCriterion[],
  byId: Map<string, SearchCriteria>,
  rules: Map<string, CriterionResult | null>,
  grader: GraderCriterionResult[] | null | undefined,
  opts: { kept: boolean; now?: number } = { kept: true },
): CriterionResult[] {
  const out: CriterionResult[] = [];
  for (const c of required) {
    const r = resolveCriterion(c, row, c.id, opts.now);
    if (opts.kept) {
      out.push({ ...(r ?? rule(c.id, "met", null)), status: "met", source: "rule", evidence: r?.evidence ?? `Matched the search filter: ${c.label}` });
    } else {
      out.push(r ?? rule(c.id, "met", `Matched the search filter: ${c.label}`));
    }
  }
  const g = new Map((grader ?? []).map((x) => [x.criterion_id, x]));
  for (const rc of ranking) {
    const r = rules.get(rc.id) ?? null;
    if (r) {
      out.push(r);
      continue;
    }
    const gr = g.get(rc.id);
    out.push(gr
      ? { criterion_id: rc.id, status: gr.status, source: "grader", evidence: gr.evidence, section: gr.section, explanation: null }
      : { criterion_id: rc.id, status: "unknown", source: "grader", evidence: null, section: null, explanation: null });
  }
  return out;
}

export type SetAsideReason =
  | "grader"
  | "employment_model"
  | "military_reserve"
  | "thin_profile"
  | "duplicates"
  | "role_class_noise"
  | "must_have";

/** The reason line for a set-aside row (spec 8). */
export function setAsideNote(reason: SetAsideReason, row: Row, ranking: RankingCriterion[] = [], failedId?: string): string {
  if (reason === "must_have") {
    const c = ranking.find((x) => x.id === failedId);
    const res = (row.criteria_results as CriterionResult[] | undefined)?.find((x) => x.criterion_id === failedId);
    return `No on: ${c?.title ?? failedId}${res?.evidence ? `. ${res.evidence}` : ""}`;
  }
  if (reason === "employment_model") return String(row.employment_model_evidence ?? row.audit_reason ?? "");
  if (reason === "military_reserve") return String(row.military_evidence ?? row.audit_reason ?? "");
  return String(row.audit_reason ?? "");
}

/**
 * Kept-row order (spec 7): match_rate desc, then the incoming order, which
 * is already grader tier, audit score and the deterministic index.
 */
export function sortByMatchRate<T extends Row>(rows: T[]): T[] {
  return rows
    .map((r, i) => ({ r, i }))
    .sort((a, b) => ((b.r.match_rate ?? -1) - (a.r.match_rate ?? -1)) || (a.i - b.i))
    .map(({ r }) => r);
}
