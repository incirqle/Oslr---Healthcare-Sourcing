/**
 * Per-search analytics (docs/oslr-criteria-ranking-spec.md 9.7). Pure and
 * client-side: takes the rows AFTER the client recompute (src/lib/ranking.ts),
 * so it follows the current criteria order and must-have state live.
 * Restored rows are already in `results`, so they count as kept.
 */
import type { Candidate, CriterionVerdict } from "@/components/search/SearchResults";
import type { RankingCriterion, RequiredCriterion } from "@/lib/ranking";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

export const VERDICTS: CriterionVerdict[] = ["met", "partial", "unknown", "not_met"];

export interface SearchAnalytics {
  funnel: {
    provider_total: number | null;
    fetched: number;
    after_required: number;
    met_must_haves: number;
    match_75: number | null;
    set_aside: { reason: string; count: number }[];
  };
  coverage: { id: string; title: string; must_have: boolean; counts: Record<CriterionVerdict, number> }[];
  match: { bucket: string; count: number }[] | null;
  /** "criteria" when the buckets use the match against the user's ranking, "fit" when they use the overall fit score. */
  match_basis: "criteria" | "fit" | null;
  employer: { private_practice: number; hospital_employed: number; unknown: number };
  subspecialty: { label: string; rule: number; grader: number; none: number } | null;
  years: { bucket: string; count: number }[];
  years_unknown: number;
  cities: { name: string; count: number }[];
  training: { name: string; count: number }[];
  military: { affiliation: string; count: number }[] | null;
}

const TRAINING_TITLE = /\b(resident|residency|fellow|fellowship|intern|internship|student|trainee|pgy)\b/i;
const TRAINING_DEGREE = /fellow|residen/i;
/** A training role, not an honorary title such as "Fellow, AAOS". */
const TRAINING_ROLE = /\b(resident|residency|fellow|fellowship)\b/i;
/** Professional bodies list members as "Fellow"; they are not training programs. */
const NOT_A_PROGRAM = /\b(academy|association|society|board of|college of surgeons|college of physicians)\b/i;
const US_STATES = new Set([
  "alabama","alaska","arizona","arkansas","california","colorado","connecticut","delaware","florida","georgia","hawaii","idaho",
  "illinois","indiana","iowa","kansas","kentucky","louisiana","maine","maryland","massachusetts","michigan","minnesota","mississippi",
  "missouri","montana","nebraska","nevada","new hampshire","new jersey","new mexico","new york","north carolina","north dakota","ohio",
  "oklahoma","oregon","pennsylvania","rhode island","south carolina","south dakota","tennessee","texas","utah","vermont","virginia",
  "washington","west virginia","wisconsin","wyoming","district of columbia","united states",
]);

const raw = (c: Candidate): Row => (c.raw ?? {}) as Row;
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

function top(counts: Map<string, number>, n: number) {
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, n).map(([name, count]) => ({ name, count }));
}

/** Years since the earliest role that is not a training role. null when unknown. */
export function yearsInPractice(c: Candidate, now = Date.now()): number | null {
  const exp: Row[] = Array.isArray(raw(c).experience_history) ? raw(c).experience_history : [];
  const starts = exp
    .filter((e) => e && !TRAINING_TITLE.test(str(e.title)))
    .map((e) => Date.parse(str(e.start_date)))
    .filter((t) => Number.isFinite(t));
  if (starts.length === 0) {
    // No dated roles: use the years of experience the profile carries.
    return typeof c.years_experience === "number" && c.years_experience > 0 ? c.years_experience : null;
  }
  return (now - Math.min(...starts)) / (365.25 * 86_400_000);
}

export function buildSearchAnalytics(
  results: Candidate[],
  hidden: Candidate[],
  required: (RequiredCriterion & { subspecialty?: boolean })[],
  ranking: RankingCriterion[],
  opts: { providerTotal?: number | null; now?: number } = {},
): SearchAnalytics {
  const all = [...results, ...hidden];
  const scored = ranking.filter((c) => !c.pending);

  // Funnel
  const reasons = new Map<string, number>();
  for (const h of hidden) {
    const r = h.set_aside_reason || (h.audit_verdict === "reject" ? "grader" : "other");
    reasons.set(r, (reasons.get(r) ?? 0) + 1);
  }
  const mustHaveAside = reasons.get("must_have") ?? 0;
  const funnel = {
    provider_total: typeof opts.providerTotal === "number" ? opts.providerTotal : null,
    fetched: all.length,
    after_required: results.length + mustHaveAside,
    met_must_haves: results.length,
    match_75: scored.length > 0 ? results.filter((c) => (c.match_rate ?? 0) >= 75).length : null,
    set_aside: [...reasons.entries()].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count),
  };

  // Criteria coverage, importance order
  const coverage = scored.map((rc) => {
    const counts: Record<CriterionVerdict, number> = { met: 0, partial: 0, unknown: 0, not_met: 0 };
    for (const c of results) {
      const s = c.criteria_results?.find((r) => r.criterion_id === rc.id)?.status ?? "unknown";
      counts[s]++;
    }
    return { id: rc.id, title: rc.title, must_have: rc.must_have, counts };
  });

  // Match distribution: the ranking match when there is a ranking, otherwise
  // the 0-100 fit score every reviewed profile already carries.
  const scoreOf = (c: Candidate): number | null =>
    scored.length > 0 ? (c.match_rate ?? 0) : typeof c.audit_score === "number" ? c.audit_score : null;
  const buckets = [
    { bucket: "0-24%", count: 0 }, { bucket: "25-49%", count: 0 }, { bucket: "50-74%", count: 0 }, { bucket: "75-100%", count: 0 },
  ];
  let scoredRows = 0;
  for (const c of results) {
    const m = scoreOf(c);
    if (m === null) continue;
    scoredRows++;
    buckets[m >= 75 ? 3 : m >= 50 ? 2 : m >= 25 ? 1 : 0].count++;
  }
  const match = scoredRows > 0 ? buckets : null;
  const match_basis: SearchAnalytics["match_basis"] = scoredRows === 0 ? null : scored.length > 0 ? "criteria" : "fit";

  // Employer type, candidates in results
  const employer = { private_practice: 0, hospital_employed: 0, unknown: 0 };
  for (const c of results) {
    if (c.employment_model === "private_practice") employer.private_practice++;
    else if (c.employment_model === "hospital_employed") employer.hospital_employed++;
    else employer.unknown++;
  }

  // Subspecialty evidence
  const sub = required.find((r) => r.subspecialty);
  let subspecialty: SearchAnalytics["subspecialty"] = null;
  if (sub) {
    subspecialty = { label: sub.label, rule: 0, grader: 0, none: 0 };
    for (const c of results) {
      const r = c.criteria_results?.find((x) => x.criterion_id === sub.id);
      const filterOnly = !r?.evidence || r.evidence.startsWith("Matched the search filter");
      if (r && (r.status === "met" || r.status === "partial") && r.source === "grader") subspecialty.grader++;
      else if (r && r.status === "met" && r.source === "rule" && !filterOnly) subspecialty.rule++;
      else subspecialty.none++;
    }
  }

  // Years in practice, kept rows
  const years = [{ bucket: "0-4", count: 0 }, { bucket: "5-9", count: 0 }, { bucket: "10-19", count: 0 }, { bucket: "20+", count: 0 }];
  let yearsUnknown = 0;
  for (const c of results) {
    const y = yearsInPractice(c, opts.now);
    if (y === null) { yearsUnknown++; continue; }
    years[y >= 20 ? 3 : y >= 10 ? 2 : y >= 5 ? 1 : 0].count++;
  }

  // Where they are: cities only. A profile that lists just a state is skipped.
  const cityCounts = new Map<string, number>();
  for (const c of results) {
    const city = str(raw(c).location_locality) || str(c.location?.split(",")[0]);
    const region = str(raw(c).location_region);
    if (!city || US_STATES.has(city.toLowerCase()) || (region && city.toLowerCase() === region.toLowerCase())) continue;
    cityCounts.set(city, (cityCounts.get(city) ?? 0) + 1);
  }

  // Training programs: education with fellow/residen in degree or major, or a fellow/resident role
  const trainCounts = new Map<string, number>();
  for (const c of results) {
    const names = new Set<string>();
    for (const e of (Array.isArray(raw(c).education) ? raw(c).education : []) as Row[]) {
      const text = [...(e?.degrees ?? []), ...(e?.majors ?? [])].join(" ");
      if (TRAINING_DEGREE.test(text) && str(e.school_name) && !NOT_A_PROGRAM.test(str(e.school_name))) names.add(str(e.school_name));
    }
    for (const e of (Array.isArray(raw(c).experience_history) ? raw(c).experience_history : []) as Row[]) {
      const org = str(e?.name) || str(e?.company_name);
      if (TRAINING_ROLE.test(str(e?.title)) && org && !NOT_A_PROGRAM.test(org)) names.add(org);
    }
    for (const n of names) trainCounts.set(n, (trainCounts.get(n) ?? 0) + 1);
  }

  // Military, kept + hidden, only when any row has one
  const milCounts = new Map<string, number>();
  for (const c of all) if (c.military_affiliation) milCounts.set(c.military_affiliation, (milCounts.get(c.military_affiliation) ?? 0) + 1);

  return {
    funnel,
    coverage,
    match,
    match_basis,
    employer,
    subspecialty,
    years,
    years_unknown: yearsUnknown,
    cities: top(cityCounts, 8),
    training: top(trainCounts, 8),
    military: milCounts.size === 0 ? null : top(milCounts, 10).map(({ name, count }) => ({ affiliation: name, count })),
  };
}
