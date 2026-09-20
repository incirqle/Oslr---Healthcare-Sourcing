/**
 * v2.ts — Crustdata v2 client + pure mappers for company-enrichment.
 *
 * The company panel reads a fixed contract (see src/hooks/useCompanyEnrichment.ts:
 * HeadcountData uses linkedin_headcount / linkedin_headcount_total_growth_percent /
 * linkedin_headcount_by_function_timeseries, GlassdoorData uses overall_rating /
 * ceo_approval …). Those are v1 /screener/company key names. v2 /company/enrich
 * returns headcount.total / growth_percent, employee_reviews.overall_rating.rating,
 * people.cxos[].basic_profile.name — so anything passed through untranslated
 * renders as empty. Every mapper here targets the UI contract explicitly.
 *
 * All requests carry x-api-version 2025-11-01. /company/enrich returns ONLY
 * basic_info unless field groups are named (spec, 2025-11-01), and 403s name
 * the denied fields — those are stripped and the call retried once.
 */

const BASE = "https://api.crustdata.com";
const API_VERSION = "2025-11-01";

/** Field groups the company panel needs. Denied ones are learned and dropped. */
export const ENRICH_FIELDS: readonly string[] = [
  "basic_info",
  "headcount",
  "funding",
  "people",
  "employee_reviews",
  "software_reviews",
  "web_traffic",
  "competitors",
  "taxonomy",
  "locations",
];

const deniedFields = new Set<string>();

function parseDeniedFields(text: string): string[] {
  try {
    const j = JSON.parse(text);
    const meta = j?.error?.metadata;
    if (Array.isArray(meta)) {
      const out: string[] = [];
      for (const m of meta) for (const f of m?.denied_fields ?? []) if (typeof f === "string") out.push(f);
      if (out.length) return out;
    }
  } catch { /* regex below */ }
  const m = text.match(/Access denied to fields:\s*([A-Za-z0-9_.,\s]+)/);
  return m ? m[1].split(",").map((s) => s.trim()).filter(Boolean) : [];
}

/** A denied path like "hiring.recent_openings" disables its group "hiring". */
function stripDenied(fields: string[]): string[] {
  return fields.filter((f) => ![...deniedFields].some((d) => d === f || d.startsWith(f + ".")));
}

// deno-lint-ignore no-explicit-any
export async function cdPostV2(path: string, body: Record<string, unknown>): Promise<any | null> {
  const key = Deno.env.get("CRUSTDATA_API_KEY");
  if (!key) {
    console.warn("[company-enrichment] CRUSTDATA_API_KEY missing");
    return null;
  }
  const send = async (b: Record<string, unknown>) => {
    const res = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        "x-api-version": API_VERSION,
      },
      body: JSON.stringify(b),
    });
    const text = await res.text();
    const credits = res.headers.get("x-credits-used");
    if (credits && credits !== "0") console.log(`[crustdata.v2 ${path}] credits=${credits}`);
    return { res, text };
  };
  try {
    let b = Array.isArray(body.fields)
      ? { ...body, fields: stripDenied(body.fields as string[]) }
      : body;
    let { res, text } = await send(b);
    if (res.status === 403 && Array.isArray(b.fields)) {
      const fresh = parseDeniedFields(text).filter((f) => !deniedFields.has(f));
      if (fresh.length) {
        for (const f of fresh) deniedFields.add(f);
        console.warn(`[crustdata.v2 ${path}] account lacks ${fresh.join(", ")} — retrying without`);
        b = { ...b, fields: stripDenied(b.fields as string[]) };
        ({ res, text } = await send(b));
      }
    }
    if (!res.ok) {
      console.error(`[crustdata.v2 ${path}] ${res.status}: ${text.slice(0, 400)}`);
      return null;
    }
    return text ? JSON.parse(text) : null;
  } catch (err) {
    console.error(`[crustdata.v2 ${path}] failed:`, err);
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Response shapes (subset)                                             */
/* ------------------------------------------------------------------ */

// deno-lint-ignore no-explicit-any
type Any = any;

/** One entry of the top-level array: { matched_on, match_type, matches[] }. */
export function firstResult(raw: Any): Any | null {
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return list[0] ?? null;
}

/** Every match's company_data, best first. */
export function matchesOf(result: Any): Any[] {
  const m = result?.matches;
  return Array.isArray(m) ? m.filter((x: Any) => x?.company_data) : [];
}

/* ------------------------------------------------------------------ */
/* Identify → candidate rows for matching.ts                            */
/* ------------------------------------------------------------------ */

export interface IdentifyCandidate {
  company_id: number;
  company_name: string;
  company_website_domain: string | null;
  all_domains: string[];
  linkedin_profile_url: string | null;
  employee_count_range: string | null;
  confidence_score: number | null;
  is_full_domain_match: boolean;
}

function normDomain(d: unknown): string | null {
  if (typeof d !== "string") return null;
  const s = d.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
  return s.includes(".") ? s : null;
}

/** Flatten a v2 identify/enrich result's matches into rows matching.ts can score. */
export function identifyCandidates(result: Any, wantDomain: string | null = null): IdentifyCandidate[] {
  const want = normDomain(wantDomain);
  const out: IdentifyCandidate[] = [];
  for (const m of matchesOf(result)) {
    const b = m.company_data?.basic_info ?? {};
    const id = b.crustdata_company_id ?? m.company_data?.crustdata_company_id;
    if (typeof id !== "number") continue;
    const primary = normDomain(b.primary_domain);
    const all = (Array.isArray(b.all_domains) ? b.all_domains : []).map(normDomain).filter((x: string | null): x is string => !!x);
    out.push({
      company_id: id,
      company_name: typeof b.name === "string" ? b.name : "",
      company_website_domain: primary,
      all_domains: all,
      linkedin_profile_url: typeof b.professional_network_url === "string" ? b.professional_network_url : null,
      employee_count_range: typeof b.employee_count_range === "string" ? b.employee_count_range : null,
      confidence_score: typeof m.confidence_score === "number" ? m.confidence_score : null,
      is_full_domain_match: !!want && (primary === want || all.includes(want)),
    });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Enrichment → UI contract                                             */
/* ------------------------------------------------------------------ */

export interface Leader {
  name: string;
  title: string;
  linkedin_url: string | null;
  profile_picture_url: string | null;
}

/** people.cxos / founders / decision_makers rows are PersonProfile (nested). */
export function mapLeader(p: Any): Leader | null {
  const bp = p?.basic_profile ?? {};
  const pn = p?.professional_network ?? {};
  const cur = p?.experience?.employment_details?.current;
  const firstCur = Array.isArray(cur) ? cur[0] : null;
  const name = bp.name ?? pn.name ?? p?.name ?? null;
  if (typeof name !== "string" || !name.trim()) return null;
  const title = bp.current_title ?? pn.current_title ?? firstCur?.employee_title ?? firstCur?.title ??
    bp.headline ?? pn.headline ?? "";
  return {
    name: name.trim(),
    title: typeof title === "string" ? title : "",
    linkedin_url: p?.social_handles?.professional_network_identifier?.profile_url ?? p?.linkedin_profile_url ?? null,
    profile_picture_url: bp.profile_picture_permalink ?? pn.profile_picture_permalink ?? pn.profile_picture_url ?? null,
  };
}

export function mapLeaders(arr: unknown): Leader[] {
  if (!Array.isArray(arr)) return [];
  return arr.map(mapLeader).filter((l): l is Leader => l !== null);
}

interface Point { date?: string | null; employee_count?: number | null }

/** Percent change between the latest point and the latest point at least `months` earlier. */
export function growthFromTimeseries(series: Point[] | null | undefined, months: number): number | null {
  if (!Array.isArray(series) || series.length < 2) return null;
  const pts = series
    .filter((p) => typeof p?.date === "string" && typeof p?.employee_count === "number")
    .map((p) => ({ t: Date.parse(p.date as string), v: p.employee_count as number }))
    .filter((p) => Number.isFinite(p.t))
    .sort((a, b) => a.t - b.t);
  if (pts.length < 2) return null;
  const latest = pts[pts.length - 1];
  const cutoff = new Date(latest.t);
  cutoff.setMonth(cutoff.getMonth() - months);
  const base = [...pts].reverse().find((p) => p.t <= cutoff.getTime());
  if (!base || base.v === 0) return null;
  return Math.round(((latest.v - base.v) / base.v) * 10000) / 100;
}

function byFunctionGrowth(ts: Any, months: number): Record<string, number> | null {
  const fn = ts?.CURRENT_FUNCTION;
  if (!fn || typeof fn !== "object") return null;
  const out: Record<string, number> = {};
  for (const [k, series] of Object.entries(fn)) {
    const g = growthFromTimeseries(series as Point[], months);
    if (g !== null) out[k] = g;
  }
  return Object.keys(out).length ? out : null;
}

/** v2 headcount → the v1-named HeadcountData the panel renders. */
export function mapHeadcount(hc: Any): Record<string, unknown> | null {
  if (!hc || typeof hc !== "object") return null;
  const total = typeof hc.total === "number" ? hc.total : null;
  const ts = hc.by_function_timeseries ?? null;
  const mapped = {
    linkedin_headcount: total,
    linkedin_headcount_total_growth_percent: hc.growth_percent ?? null,
    linkedin_headcount_total_growth_absolute: hc.growth_absolute ?? null,
    linkedin_headcount_timeseries: Array.isArray(hc.timeseries) ? hc.timeseries : null,
    linkedin_headcount_by_role_absolute: hc.by_role_absolute ?? null,
    linkedin_headcount_by_role_percent: hc.by_role_percent ?? null,
    linkedin_headcount_by_role_six_months_growth_percent: byFunctionGrowth(ts, 6),
    linkedin_headcount_by_role_yoy_growth_percent: byFunctionGrowth(ts, 12),
    linkedin_headcount_by_region_absolute: hc.by_region_absolute ?? null,
    linkedin_headcount_by_region_percent: hc.by_region_percent ?? null,
    linkedin_headcount_by_skill_absolute: hc.by_skill_absolute ?? null,
    linkedin_headcount_by_skill_percent: hc.by_skill_percent ?? null,
    linkedin_headcount_by_function_timeseries: ts,
    largest_headcount_country: hc.largest_headcount_country ?? null,
  };
  return Object.values(mapped).some((v) => v !== null) ? mapped : null;
}

function num(v: unknown): number | null {
  const n = typeof v === "string" ? parseFloat(v) : (v as number);
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

/** v2 employee_reviews → GlassdoorData. */
export function mapEmployeeReviews(er: Any) {
  if (!er || typeof er !== "object") return null;
  const g = {
    overall_rating: num(er.overall_rating?.rating),
    review_count: num(er.overall_rating?.total_count),
    ceo_approval: num(er.company_ceo?.ceo_rating),
    business_outlook: num(er.business_outlook_rating),
    recommend_to_friend: num(er.recommend_to_friend_rating),
    culture_and_values_rating: num(er.culture_and_values_rating),
    work_life_balance_rating: num(er.work_life_balance_rating),
    compensation_and_benefits_rating: num(er.compensation_and_benefits_rating),
  };
  return Object.values(g).some((v) => v !== null) ? g : null;
}

/** v2 software_reviews → the old g2 slot. */
export function mapSoftwareReviews(sr: Any) {
  if (!sr || typeof sr !== "object") return null;
  const g = { review_count: num(sr.review_count), average_rating: num(sr.average_rating) };
  return g.review_count === null && g.average_rating === null ? null : g;
}

/** v2 web_traffic.domain_traffic (keyed by domain) → WebTrafficData for the primary domain. */
export function mapWebTraffic(wt: Any, preferDomain: string | null) {
  const dt = wt?.domain_traffic;
  if (!dt || typeof dt !== "object") return null;
  const want = normDomain(preferDomain);
  const entries = Object.entries(dt) as Array<[string, Any]>;
  if (!entries.length) return null;
  const chosen = (want && entries.find(([d]) => normDomain(d) === want)) ??
    entries.reduce((a, b) => (num(b[1]?.monthly_visitors) ?? 0) > (num(a[1]?.monthly_visitors) ?? 0) ? b : a);
  const t = chosen[1] ?? {};
  const out = {
    domain: chosen[0],
    monthly_visitors: num(t.monthly_visitors),
    growth_mom_percent: num(t.mom_pct),
    growth_qoq_percent: num(t.qoq_pct),
    source_search_pct: num(t.source_search_pct),
    source_direct_pct: num(t.source_direct_pct),
    source_social_pct: num(t.source_social_pct),
    monthly_visitors_timeseries: Array.isArray(t.monthly_visitors_timeseries) ? t.monthly_visitors_timeseries : null,
  };
  return out.monthly_visitors === null && out.growth_mom_percent === null ? null : out;
}

export function mapIndustry(cd: Any): string | null {
  const t = cd?.taxonomy ?? {};
  if (typeof t.professional_network_industry === "string" && t.professional_network_industry) return t.professional_network_industry;
  const arr = Array.isArray(t.professional_network_industries) ? t.professional_network_industries : cd?.basic_info?.industries;
  if (Array.isArray(arr) && typeof arr[0] === "string") return arr[0];
  return null;
}

export interface MappedEnrichment {
  company_name: string | null;
  company_website_domain: string | null;
  linkedin_profile_url: string | null;
  linkedin_logo_url: string | null;
  description: string | null;
  year_founded: number | null;
  employee_count_range: string | null;
  company_type: string | null;
  headquarters: string | null;
  hq_city: string | null;
  hq_state: string | null;
  hq_country: string | null;
  industry: string | null;
  headcount: Record<string, unknown> | null;
  glassdoor: ReturnType<typeof mapEmployeeReviews>;
  g2: ReturnType<typeof mapSoftwareReviews>;
  web_traffic: ReturnType<typeof mapWebTraffic>;
  funding: Record<string, unknown> | null;
  cxos: Leader[];
  decision_makers: Leader[];
  founders: Leader[];
  competitor_domains: string[];
}

/** One /company/enrich match's company_data → everything the panel contract needs. */
export function mapEnrichment(cd: Any, preferDomain: string | null = null): MappedEnrichment {
  const b = cd?.basic_info ?? {};
  const loc = cd?.locations ?? {};
  const hqStr: string | null = typeof loc.headquarters === "string" && loc.headquarters ? loc.headquarters : null;
  const hqParts = hqStr ? hqStr.split(",").map((s: string) => s.trim()).filter(Boolean) : [];
  const comp = cd?.competitors ?? {};
  const competitorDomains: string[] = Array.isArray(comp.all_domains) && comp.all_domains.length
    ? comp.all_domains
    : [...(Array.isArray(comp.organic_seo) ? comp.organic_seo : []), ...(Array.isArray(comp.paid_seo) ? comp.paid_seo : [])];
  const primaryDomain = normDomain(b.primary_domain) ?? normDomain(b.website);
  return {
    company_name: typeof b.name === "string" ? b.name : null,
    company_website_domain: primaryDomain,
    linkedin_profile_url: typeof b.professional_network_url === "string" ? b.professional_network_url : null,
    linkedin_logo_url: typeof b.logo_permalink === "string" ? b.logo_permalink : null,
    description: typeof b.description === "string" ? b.description : null,
    year_founded: typeof b.year_founded === "number" ? b.year_founded : null,
    employee_count_range: typeof b.employee_count_range === "string" ? b.employee_count_range : null,
    company_type: typeof b.company_type === "string" ? b.company_type : null,
    headquarters: hqStr,
    hq_city: hqParts[0] ?? null,
    hq_state: (typeof loc.state === "string" && loc.state) || hqParts[1] || null,
    hq_country: (typeof loc.country === "string" && loc.country) || hqParts[hqParts.length - 1] || null,
    industry: mapIndustry(cd),
    headcount: mapHeadcount(cd?.headcount),
    glassdoor: mapEmployeeReviews(cd?.employee_reviews),
    g2: mapSoftwareReviews(cd?.software_reviews),
    web_traffic: mapWebTraffic(cd?.web_traffic, preferDomain ?? primaryDomain),
    funding: cd?.funding && typeof cd.funding === "object" ? cd.funding : null,
    cxos: mapLeaders(cd?.people?.cxos),
    decision_makers: mapLeaders(cd?.people?.decision_makers),
    founders: mapLeaders(cd?.people?.founders),
    competitor_domains: [...new Set(competitorDomains.map(normDomain).filter((x): x is string => !!x))],
  };
}

/* ------------------------------------------------------------------ */
/* /person/search rows → talent-flow people                             */
/* ------------------------------------------------------------------ */

export interface TalentFlowPerson {
  name: string;
  first_name: string | null;
  last_name: string | null;
  linkedin_profile_url: string | null;
  profile_picture_url: string | null;
  headline: string | null;
  current_title: string | null;
  current_company: string | null;
  current_company_linkedin_url: string | null;
  current_company_start_date: string | null;
  previous_company: string | null;
  previous_company_linkedin_url: string | null;
  previous_title: string | null;
  previous_end_date: string | null;
  function_category: string | null;
  seniority_level: string | null;
}

/** v2 employment rows: keys observed live (probe log A/D) + the normalizer's fallbacks. */
function empCompanyId(e: Any): number | null {
  const id = e?.crustdata_company_id ?? e?.company_id;
  return typeof id === "number" ? id : null;
}
function empName(e: Any): string | null { return e?.name ?? e?.company_name ?? e?.company ?? e?.employer_name ?? null; }
function empTitle(e: Any): string | null { return e?.title ?? e?.employee_title ?? null; }
function empLinkedIn(e: Any): string | null {
  return e?.company_professional_network_url ?? e?.company_linkedin_profile_url ?? e?.company_linkedin_url ?? null;
}

export function mapTalentFlowPerson(
  person: Any,
  targetIds: Set<number>,
  direction: "hires" | "departures",
): TalentFlowPerson {
  const bp = person?.basic_profile ?? {};
  const emp = person?.experience?.employment_details ?? {};
  const current: Any[] = Array.isArray(emp.current) ? emp.current : [];
  const past: Any[] = Array.isArray(emp.past) ? emp.past : [];
  const atTarget = (e: Any) => { const id = empCompanyId(e); return id !== null && targetIds.has(id); };
  const targetCurrent = direction === "hires" ? (current.find(atTarget) ?? current[0] ?? {}) : (current[0] ?? {});
  const targetPast = direction === "departures" ? (past.find(atTarget) ?? past[0] ?? {}) : (past[0] ?? {});
  return {
    name: bp.name ?? person?.name ?? "Unknown",
    first_name: bp.first_name ?? null,
    last_name: bp.last_name ?? null,
    linkedin_profile_url: person?.social_handles?.professional_network_identifier?.profile_url ?? person?.linkedin_profile_url ?? null,
    profile_picture_url: bp.profile_picture_permalink ?? null,
    headline: bp.headline ?? null,
    current_title: empTitle(targetCurrent) ?? empTitle(current[0]),
    current_company: empName(targetCurrent) ?? empName(current[0]),
    current_company_linkedin_url: empLinkedIn(targetCurrent) ?? empLinkedIn(current[0]),
    current_company_start_date: targetCurrent?.start_date ?? current[0]?.start_date ?? null,
    previous_company: empName(targetPast),
    previous_company_linkedin_url: empLinkedIn(targetPast),
    previous_title: empTitle(targetPast),
    previous_end_date: targetPast?.end_date ?? null,
    function_category: targetCurrent?.function_category ?? current[0]?.function_category ?? null,
    seniority_level: targetCurrent?.seniority_level ?? current[0]?.seniority_level ?? null,
  };
}
