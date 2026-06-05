/**
 * company-enrichment edge function — full company intelligence endpoint.
 *
 * Returns the rich payload required for the "Company insights" / "Hiring
 * activity" / "Talent flow" tabs in the Company Intel modal.
 *
 * Data sources (all CrustData):
 *   1. POST /screener/identify          — FREE, resolves name → ALL entity IDs
 *   2. GET  /screener/company?fields=…  — 1 credit, full enrichment
 *   3. POST /job/search                 — 1 credit, open jobs
 *   4. POST /screener/persondb/search   — 3 credits each, talent flow
 *
 * Cached 7 days in company_enrichment_cache (schema_version 9).
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CRUSTDATA_BASE_URL = "https://api.crustdata.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/* ------------------------------------------------------------------ */
/* Pre-mapped health systems (parity with pdl-search/resolve-company)   */
/* ------------------------------------------------------------------ */

const COMPANY_ALIASES: Record<string, string> = {
  "uc health": "uchealth",
  "uchealth": "uchealth",
  "university of colorado health": "uchealth",
  "uch": "uchealth",
  "university of colorado hospital": "uchealth",
  "university of colorado anschutz": "uchealth",
  "university of colorado anschutz medical campus": "uchealth",
  "university of colorado school of medicine": "uchealth",
};

const PREMAPPED_ENTITY_IDS: Record<string, number[]> = {
  uchealth: [
    1304813, 6259524, 6524064, 9255529, 12929305, 10791937, 9819138, 6644127,
    670107, 6041104, 2056710,
  ],
};

function resolveCanonical(name: string | null): string | null {
  if (!name) return null;
  const lower = name.toLowerCase().trim();
  return COMPANY_ALIASES[lower] ?? lower;
}

/* ------------------------------------------------------------------ */
/* CrustData helpers                                                    */
/* ------------------------------------------------------------------ */

function authHeaders(extra?: Record<string, string>) {
  const apiKey = Deno.env.get("CRUSTDATA_API_KEY") ?? "";
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    ...(extra ?? {}),
  };
}

async function cdGet(path: string): Promise<any | null> {
  if (!Deno.env.get("CRUSTDATA_API_KEY")) return null;
  try {
    const res = await fetch(`${CRUSTDATA_BASE_URL}${path}`, {
      method: "GET",
      headers: authHeaders(),
    });
    if (!res.ok) {
      console.error(`[CrustData GET ${path}] ${res.status}: ${await res.text()}`);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error(`[CrustData GET ${path}] failed:`, err);
    return null;
  }
}

async function cdPost(
  path: string,
  body: unknown,
  extra?: Record<string, string>,
): Promise<any | null> {
  if (!Deno.env.get("CRUSTDATA_API_KEY")) return null;
  try {
    const res = await fetch(`${CRUSTDATA_BASE_URL}${path}`, {
      method: "POST",
      headers: authHeaders(extra),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.error(`[CrustData POST ${path}] ${res.status}: ${await res.text()}`);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error(`[CrustData POST ${path}] failed:`, err);
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Step 1 — identify (collects ALL entity IDs for a health system)      */
/* ------------------------------------------------------------------ */

interface Identified {
  company_id: number;
  company_name: string;
  linkedin_profile_url: string | null;
  company_website_domain: string | null;
  headcount: number | null;
  hq_city: string | null;
  hq_country: string | null;
  all_ids: number[];
}

function headcountRank(c: any): number {
  if (typeof c?.linkedin_headcount === "number" && c.linkedin_headcount > 0) {
    return c.linkedin_headcount;
  }
  const range: string | undefined = c?.employee_count_range;
  if (!range) return 0;
  const m = range.match(/(\d+)/g);
  if (!m) return 0;
  return parseInt(m[m.length - 1], 10) || 0;
}

function pickBestCandidate(
  candidates: any[],
  name: string | null,
  domain: string | null,
): any | null {
  if (!Array.isArray(candidates) || candidates.length === 0) return null;
  const wantName = (name ?? "").toLowerCase().trim();
  const wantDomain = (domain ?? "").toLowerCase().trim().replace(/^www\./, "");
  const scored = candidates.map((c) => {
    let score = 0;
    const cName = String(c?.company_name ?? "").toLowerCase().trim();
    const cDomain = String(c?.company_website_domain ?? "")
      .toLowerCase()
      .trim()
      .replace(/^www\./, "");
    if (wantDomain && cDomain === wantDomain) score += 1000;
    if (c?.is_full_domain_match) score += 500;
    if (wantName && cName === wantName) score += 200;
    if (wantName && cName.startsWith(wantName)) score += 50;
    score += Math.min(headcountRank(c), 100_000) / 1000;
    return { c, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0].c;
}

async function identifyByName(
  name: string,
  domain?: string | null,
): Promise<Identified | null> {
  const canonical = resolveCanonical(name);

  // 1. Pre-mapped systems return a curated, complete entity list.
  const premapped = canonical ? PREMAPPED_ENTITY_IDS[canonical] : null;

  const payload: Record<string, unknown> = { exact_match: false, count: 25 };
  if (name) {
    payload.query_company_name = name;
  } else if (domain) {
    payload.query_company_website = domain.startsWith("http")
      ? domain
      : `https://${domain}`;
  } else {
    return null;
  }
  const raw = await cdPost("/screener/identify", payload);
  const list: any[] = Array.isArray(raw) ? raw : raw ? [raw] : [];
  if (list.length === 0 && !premapped) {
    console.warn("[company-enrichment] identify miss", { name, domain });
    return null;
  }
  const best = pickBestCandidate(list, name, domain ?? null) ?? null;
  const primaryId = best?.company_id ?? premapped?.[0] ?? null;
  if (!primaryId) {
    console.warn("[company-enrichment] identify no usable id", { name, domain });
    return null;
  }

  // 2. Combine all returned IDs whose name closely overlaps the canonical
  //    name with the curated pre-map. This is the entity set used for
  //    talent flow / jobs queries.
  const tokens = (canonical ?? name).toLowerCase().split(/\W+/).filter(Boolean);
  const liveIds: number[] = [];
  for (const c of list) {
    if (!c?.company_id) continue;
    const cName = String(c.company_name ?? "").toLowerCase();
    const overlap = tokens.filter((t) => t.length >= 4 && cName.includes(t)).length;
    // Always include the best match; otherwise require at least one
    // distinctive token overlap to avoid pulling in unrelated companies.
    if (c.company_id === primaryId || overlap >= 1) liveIds.push(c.company_id);
  }

  const allIds = Array.from(
    new Set<number>([primaryId, ...(premapped ?? []), ...liveIds]),
  );

  console.info("[company-enrichment] identified", {
    name,
    canonical,
    primary_id: primaryId,
    chosen_name: best?.company_name ?? null,
    candidates: list.length,
    all_ids: allIds.length,
  });
  return {
    company_id: primaryId,
    company_name: best?.company_name || name,
    linkedin_profile_url: best?.linkedin_profile_url ?? null,
    company_website_domain: best?.company_website_domain ?? null,
    headcount: typeof best?.linkedin_headcount === "number" ? best.linkedin_headcount : null,
    hq_city: best?.hq_city ?? null,
    hq_country: best?.hq_country ?? null,
    all_ids: allIds,
  };
}

/* ------------------------------------------------------------------ */
/* Step 2 — enrichment                                                  */
/* ------------------------------------------------------------------ */

async function enrich(companyId: number): Promise<Record<string, unknown> | null> {
  // CrustData returns NESTED objects under glassdoor / g2 / web_traffic /
  // headcount / taxonomy / competitors / funding_and_investment. Using a
  // top-level prefix hydrates every sub-field.
  const fields = [
    "company_name",
    "company_website_domain",
    "linkedin_profile_url",
    "linkedin_logo_url",
    "linkedin_company_description",
    "headquarters",
    "hq_state",
    "hq_country",
    "year_founded",
    "employee_count_range",
    "taxonomy",
    "competitors",
    "headcount",
    "glassdoor",
    "g2",
    "web_traffic",
    "funding_and_investment",
    "cxos",
    "decision_makers",
  ].join(",");
  const raw = await cdGet(`/screener/company?company_id=${companyId}&fields=${fields}`);
  if (!raw) return null;
  const list: any[] = Array.isArray(raw) ? raw : [raw];
  const row = list[0] ?? null;
  if (row) {
    console.log("[company-enrichment] enrichment keys:", Object.keys(row));
    if (row.glassdoor) console.log("[glassdoor keys]", Object.keys(row.glassdoor));
    if (row.g2) console.log("[g2 keys]", Object.keys(row.g2));
    if (row.web_traffic) console.log("[web_traffic keys]", Object.keys(row.web_traffic));
  }
  return row;
}
  return list[0] ?? null;
}

/* ------------------------------------------------------------------ */
/* Step 3 — job listings                                                */
/* ------------------------------------------------------------------ */

interface JobListing {
  title: string;
  location_text: string | null;
  workplace_type: string | null;
  date_added: string | null;
  url: string | null;
  category: string | null;
}

async function fetchJobs(companyIds: number[]): Promise<{ jobs: JobListing[]; total: number }> {
  if (!companyIds.length) return { jobs: [], total: 0 };
  const d = await cdPost(
    "/job/search",
    {
      filters: {
        op: "and",
        conditions: [{ column: "company_id", type: "in", value: companyIds }],
      },
      offset: 0,
      limit: 50,
      sorts: [{ column: "date_added", type: "desc" }],
    },
    { "x-api-version": "2025-11-01" },
  );
  if (!d) return { jobs: [], total: 0 };

  const fields: { api_name: string }[] = d.fields ?? [];
  const rows: unknown[][] = d.rows ?? [];
  const idx: Record<string, number> = {};
  fields.forEach((f, i) => (idx[f.api_name] = i));

  const jobs: JobListing[] = rows.map((row) => ({
    title: (row[idx["title"]] as string) ?? "",
    location_text: (row[idx["location_text"]] as string) ?? null,
    workplace_type: (row[idx["workplace_type"]] as string) ?? null,
    date_added: (row[idx["date_added"]] as string) ?? null,
    url: (row[idx["url"]] as string) ?? null,
    category: (row[idx["category"]] as string) ?? null,
  }));

  const total =
    typeof d.total_rows === "number"
      ? d.total_rows
      : rows.length > 0
        ? ((rows[0][rows[0].length - 1] as number) ?? rows.length)
        : 0;

  return { jobs, total };
}

/* ------------------------------------------------------------------ */
/* Step 3b — talent flow (recent hires / departures)                    */
/* ------------------------------------------------------------------ */

interface TalentFlowPerson {
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

interface TalentFlowAggregate {
  hires: TalentFlowPerson[];
  departures: TalentFlowPerson[];
  hire_count: number;
  departure_count: number;
  top_hire_sources: { company: string; count: number; linkedin_url: string | null }[];
  top_departure_destinations: { company: string; count: number; linkedin_url: string | null }[];
}

function isoMonthsAgo(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d.toISOString().slice(0, 10);
}

function idSet(ids: number[]): Set<number> {
  return new Set(ids);
}

async function fetchTalentFlow(
  companyIds: number[],
  direction: "hires" | "departures",
  monthsBack: number,
): Promise<TalentFlowPerson[]> {
  if (!companyIds.length) return [];

  const sinceDate = isoMonthsAgo(monthsBack);
  const employerField =
    direction === "hires"
      ? "current_employers.company_id"
      : "past_employers.company_id";
  const dateField =
    direction === "hires"
      ? "current_employers.start_date"
      : "past_employers.end_date";

  const body = {
    dataset: "people",
    filters: {
      op: "and",
      conditions: [
        { column: employerField, type: "in", value: companyIds },
        { column: dateField, type: ">=", value: sinceDate },
      ],
    },
    limit: 50,
  };

  const data = await cdPost("/screener/persondb/search", body, { "x-api-version": "2025-11-01" });
  if (!data) return [];
  const results: any[] = (data as { results?: unknown[] }).results ?? [];
  console.log(
    `[talent-flow ${direction}] entity_ids=${companyIds.length} since=${sinceDate} got=${results.length}`,
  );

  const targetIds = idSet(companyIds);

  return results.map((person: any) => {
    const currentEmployers: any[] = person.current_employers || [];
    const pastEmployers: any[] = person.past_employers || [];

    // Find the row for the company we asked about, on the correct side.
    const targetCurrent =
      direction === "hires"
        ? currentEmployers.find((e: any) => targetIds.has(e.company_id)) ||
          currentEmployers[0] ||
          {}
        : currentEmployers[0] || {};
    const targetPast =
      direction === "departures"
        ? pastEmployers.find((e: any) => targetIds.has(e.company_id)) ||
          pastEmployers[0] ||
          {}
        : pastEmployers[0] || {};

    return {
      name: person.name || "Unknown",
      first_name: person.first_name || null,
      last_name: person.last_name || null,
      linkedin_profile_url: person.linkedin_profile_url || null,
      profile_picture_url: person.profile_picture_url || null,
      headline: person.headline || null,
      current_title: targetCurrent.title || currentEmployers[0]?.title || null,
      current_company: targetCurrent.name || currentEmployers[0]?.name || null,
      current_company_linkedin_url:
        targetCurrent.company_linkedin_profile_url ||
        currentEmployers[0]?.company_linkedin_profile_url ||
        null,
      current_company_start_date:
        targetCurrent.start_date || currentEmployers[0]?.start_date || null,
      previous_company:
        direction === "hires"
          ? pastEmployers[0]?.name || null
          : targetPast.name || pastEmployers[0]?.name || null,
      previous_company_linkedin_url:
        direction === "hires"
          ? pastEmployers[0]?.company_linkedin_profile_url || null
          : targetPast.company_linkedin_profile_url || null,
      previous_title:
        direction === "hires"
          ? pastEmployers[0]?.title || null
          : targetPast.title || null,
      previous_end_date:
        direction === "hires"
          ? pastEmployers[0]?.end_date || null
          : targetPast.end_date || null,
      function_category:
        targetCurrent.function_category ||
        currentEmployers[0]?.function_category ||
        null,
      seniority_level:
        targetCurrent.seniority_level ||
        currentEmployers[0]?.seniority_level ||
        null,
    };
  });
}

function aggregateTalentFlow(
  hires: TalentFlowPerson[],
  departures: TalentFlowPerson[],
): TalentFlowAggregate {
  const hireSources = new Map<string, { count: number; linkedin_url: string | null }>();
  for (const h of hires) {
    if (h.previous_company) {
      const ex = hireSources.get(h.previous_company) || {
        count: 0,
        linkedin_url: h.previous_company_linkedin_url,
      };
      ex.count++;
      hireSources.set(h.previous_company, ex);
    }
  }
  const depDests = new Map<string, { count: number; linkedin_url: string | null }>();
  for (const d of departures) {
    if (d.current_company) {
      const ex = depDests.get(d.current_company) || {
        count: 0,
        linkedin_url: d.current_company_linkedin_url,
      };
      ex.count++;
      depDests.set(d.current_company, ex);
    }
  }
  const top = (m: Map<string, { count: number; linkedin_url: string | null }>) =>
    Array.from(m.entries())
      .map(([company, { count, linkedin_url }]) => ({ company, count, linkedin_url }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

  return {
    hires,
    departures,
    hire_count: hires.length,
    departure_count: departures.length,
    top_hire_sources: top(hireSources),
    top_departure_destinations: top(depDests),
  };
}

/* ------------------------------------------------------------------ */
/* Step 4 — competitor resolution                                       */
/* ------------------------------------------------------------------ */

interface Competitor {
  company_id: number;
  company_name: string;
  linkedin_profile_url: string | null;
  company_website_domain: string | null;
  headcount: number | null;
}

async function resolveCompetitorsByDomain(domains: string[]): Promise<Competitor[]> {
  if (!domains?.length) return [];
  const cleaned = domains
    .map((d) => String(d || "").trim().replace(/^https?:\/\//, "").replace(/\/$/, ""))
    .filter(Boolean)
    .slice(0, 6);
  const out = await Promise.all(
    cleaned.map(async (domain) => {
      const raw = await cdPost("/screener/identify", {
        query_company_website: domain.startsWith("http") ? domain : `https://${domain}`,
      });
      const list: any[] = Array.isArray(raw) ? raw : raw ? [raw] : [];
      const d = list[0];
      if (!d?.company_id) return null;
      return {
        company_id: d.company_id,
        company_name: d.company_name ?? domain,
        linkedin_profile_url: d.linkedin_profile_url ?? null,
        company_website_domain: d.company_website_domain ?? domain,
        headcount:
          typeof d.linkedin_headcount === "number" ? d.linkedin_headcount : null,
      } as Competitor;
    }),
  );
  return out.filter((c): c is Competitor => c !== null);
}

/* ------------------------------------------------------------------ */
/* Mappers                                                              */
/* ------------------------------------------------------------------ */

function num(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "string" ? parseFloat(v) : (v as number);
  return Number.isFinite(n) ? n : null;
}

function mapGlassdoor(e: Record<string, unknown> | null) {
  if (!e) return null;
  const overall = num(e.glassdoor_overall_rating);
  const reviews = num(e.glassdoor_review_count);
  const ceo = num(e.glassdoor_ceo_approval);
  const outlook = num(e.glassdoor_business_outlook);
  const recommend = num(e.glassdoor_recommend_to_friend_percent);
  if ([overall, reviews, ceo, outlook, recommend].every((v) => v == null)) return null;
  return {
    overall_rating: overall,
    review_count: reviews,
    ceo_approval: ceo,
    business_outlook: outlook,
    recommend_to_friend: recommend,
  };
}

function mapG2(e: Record<string, unknown> | null) {
  if (!e) return null;
  const reviews = num(e.g2_review_count);
  const rating = num(e.g2_average_rating);
  if (reviews == null && rating == null) return null;
  return { review_count: reviews, average_rating: rating };
}

function mapWebTraffic(e: Record<string, unknown> | null) {
  if (!e) return null;
  const visitors = num(e.monthly_visitors);
  const mom = num(e.monthly_visitors_mom_pct);
  if (visitors == null && mom == null) return null;
  return { monthly_visitors: visitors, growth_mom_percent: mom };
}

function mapIndustry(taxonomy: any): string | null {
  if (!taxonomy) return null;
  if (typeof taxonomy.linkedin_industry === "string") return taxonomy.linkedin_industry;
  const arr = taxonomy.linkedin_industries;
  if (Array.isArray(arr) && arr.length) {
    const first = arr[0];
    if (typeof first === "string") return first;
    if (first && typeof first === "object") {
      return (first.industry as string) ?? (first.name as string) ?? null;
    }
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Main handler                                                         */
/* ------------------------------------------------------------------ */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const company_name: string | null =
      typeof body?.company_name === "string" ? body.company_name : null;
    const company_domain: string | null =
      typeof body?.company_domain === "string" ? body.company_domain : null;
    const provided_id: number | null =
      typeof body?.company_id === "number" ? body.company_id : null;
    const provided_ids: number[] = Array.isArray(body?.crustdata_entity_ids)
      ? (body.crustdata_entity_ids as unknown[]).filter(
          (n): n is number => typeof n === "number" && Number.isFinite(n),
        )
      : [];
    const canonical_company_name: string | null =
      typeof body?.canonical_company_name === "string"
        ? body.canonical_company_name
        : null;

    if (!company_name && !provided_id && provided_ids.length === 0) {
      return new Response(
        JSON.stringify({ error: "company_name, company_id or crustdata_entity_ids required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Resolve entity set first so the cache key is canonical across all
    // entry points (name-only lookups and IDs-provided lookups converge).
    let identified: Identified | null = null;
    let allIds: number[] = [];
    let primaryId: number | null = provided_id;

    if (provided_ids.length > 0) {
      allIds = Array.from(new Set(provided_ids));
      primaryId = primaryId ?? allIds[0];
    } else if (provided_id) {
      allIds = [provided_id];
    } else if (company_name) {
      identified = await identifyByName(company_name, company_domain);
      if (!identified) {
        return new Response(
          JSON.stringify({ company: null, error: "Company not found" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      primaryId = identified.company_id;
      allIds = identified.all_ids;
    }

    if (!primaryId) {
      return new Response(JSON.stringify({ company: null }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (allIds.length === 0) allIds = [primaryId];

    const canonical =
      canonical_company_name ?? resolveCanonical(company_name) ?? String(primaryId);
    const sortedIds = [...allIds].sort((a, b) => a - b);
    const cacheKey = `${canonical.toLowerCase().trim()}:${sortedIds.join(",")}`;

    // Cache check (7 days, schema_version 9)
    try {
      const { data: cached } = await supabase
        .from("company_enrichment_cache")
        .select("data, created_at")
        .eq("cache_key", cacheKey)
        .maybeSingle();

      if (cached?.data && (cached.data as any)?.schema_version === 9) {
        const age = Date.now() - new Date(cached.created_at as string).getTime();
        if (age < 7 * 24 * 60 * 60 * 1000) {
          return new Response(
            JSON.stringify({ company: { ...(cached.data as object), cached: true } }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      }
    } catch {
      /* miss */
    }

    // Steps 2–3 in parallel (talent flow widens to 24mo on its own if 12mo is too sparse)
    const [enrichment, jobsResult, hiresList12, departuresList12] = await Promise.all([
      enrich(primaryId),
      fetchJobs(allIds),
      fetchTalentFlow(allIds, "hires", 12),
      fetchTalentFlow(allIds, "departures", 12),
    ]);

    let hiresList = hiresList12;
    let departuresList = departuresList12;
    if (hiresList.length + departuresList.length < 5) {
      console.log(
        `[talent-flow] sparse @12mo (h=${hiresList.length} d=${departuresList.length}), widening to 24mo`,
      );
      const [h24, d24] = await Promise.all([
        fetchTalentFlow(allIds, "hires", 24),
        fetchTalentFlow(allIds, "departures", 24),
      ]);
      hiresList = h24;
      departuresList = d24;
    }
    const talent_flow = aggregateTalentFlow(hiresList, departuresList);

    // Step 4 — competitors (CrustData returns domain lists)
    const compBlock = (enrichment?.competitors as any) ?? {};
    const compDomains: string[] = [
      ...((compBlock?.competitor_website_domains as string[]) ?? []),
      ...((compBlock?.organic_seo_competitors_website_domains as string[]) ?? []),
      ...((compBlock?.paid_seo_competitors_website_domains as string[]) ?? []),
    ];
    const seen = new Set<string>();
    const uniqueDomains = compDomains.filter((d) => {
      const k = String(d || "").trim().toLowerCase();
      if (!k || seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    const competitors = await resolveCompetitorsByDomain(uniqueDomains);

    // Parse "City, State, Country" from headquarters
    const hqStr = (enrichment?.headquarters as string) || "";
    const hqParts = hqStr.split(",").map((s) => s.trim()).filter(Boolean);
    const parsedHqCity = hqParts[0] ?? null;

    const company = {
      schema_version: 9 as const,
      company_id: primaryId,
      crustdata_entity_ids: allIds,
      company_name:
        (enrichment?.company_name as string) ||
        identified?.company_name ||
        company_name ||
        canonical,
      company_website_domain:
        (enrichment?.company_website_domain as string) ||
        identified?.company_website_domain ||
        company_domain ||
        null,
      linkedin_profile_url:
        (enrichment?.linkedin_profile_url as string) ||
        identified?.linkedin_profile_url ||
        null,
      linkedin_logo_url: (enrichment?.linkedin_logo_url as string) ?? null,
      hq_city: parsedHqCity ?? identified?.hq_city ?? null,
      hq_state: (enrichment?.hq_state as string) ?? null,
      hq_country:
        (enrichment?.hq_country as string) ?? identified?.hq_country ?? null,
      headquarters: hqStr || null,
      industry: mapIndustry(enrichment?.taxonomy),
      description: (enrichment?.linkedin_company_description as string) ?? null,
      year_founded: (enrichment?.year_founded as string | number) ?? null,
      employee_count_range: (enrichment?.employee_count_range as string) ?? null,

      headcount: enrichment?.headcount ?? null,
      glassdoor: mapGlassdoor((enrichment ?? null) as Record<string, unknown> | null),
      g2: mapG2((enrichment ?? null) as Record<string, unknown> | null),
      web_traffic: mapWebTraffic((enrichment ?? null) as Record<string, unknown> | null),
      funding: enrichment?.funding_and_investment ?? null,
      cxos: enrichment?.cxos ?? [],
      decision_makers: enrichment?.decision_makers ?? [],

      jobs: jobsResult.jobs,
      jobs_total: jobsResult.total,

      competitors,

      talent_flow,

      cached: false,
      enriched_at: new Date().toISOString(),
    };

    try {
      await supabase.from("company_enrichment_cache").upsert({
        cache_key: cacheKey,
        company_id: primaryId,
        data: company,
        created_at: new Date().toISOString(),
      });
    } catch {
      /* non-fatal */
    }

    return new Response(JSON.stringify({ company }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[company-enrichment] Error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
