/**
 * company-enrichment edge function — full company intelligence endpoint.
 *
 * Returns the rich payload required for the "Company insights" / "Hiring
 * activity" / "Talent flow" tabs in the Company Intel modal.
 *
 * Data sources (all Crustdata v2, x-api-version 2025-11-01):
 *   1. POST /company/identify   — FREE, resolves name/domain → candidate entities
 *   2. POST /company/enrich     — full enrichment; field groups named explicitly
 *   3. POST /job/search         — open jobs
 *   4. POST /person/search      — talent flow (recent hires / departures)
 *
 * v2 shapes are translated in ./v2.ts onto the key names the panel already
 * reads (src/hooks/useCompanyEnrichment.ts), so the UI contract is unchanged.
 * Cached 7 days in company_enrichment_cache (schema_version 12).
 */

import { pickBestCandidate, selectRelatedEntityIds } from "./matching.ts";
import {
  cdPostV2,
  ENRICH_FIELDS,
  firstResult,
  identifyCandidates,
  mapEnrichment,
  mapTalentFlowPerson,
  matchesOf,
  type MappedEnrichment,
} from "./v2.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/* ------------------------------------------------------------------ */
/* Pre-mapped health systems (parity with the legacy company resolver)  */
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

async function identifyByName(
  name: string,
  domain?: string | null,
): Promise<Identified | null> {
  const canonical = resolveCanonical(name);

  // 1. Pre-mapped systems return a curated, complete entity list.
  const premapped = canonical ? PREMAPPED_ENTITY_IDS[canonical] : null;

  // v2 identify: one identifier type per call. A domain is the sharper key;
  // fall back to the name when the domain yields nothing.
  const wantDomain = domain ? domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0] : null;
  let list = wantDomain
    ? identifyCandidates(firstResult(await cdPostV2("/company/identify", { domains: [wantDomain] })), wantDomain)
    : [];
  if (list.length === 0 && name) {
    list = identifyCandidates(firstResult(await cdPostV2("/company/identify", { names: [name] })), wantDomain);
  }
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
  const liveIds = selectRelatedEntityIds(list, primaryId, canonical ?? name);

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

async function enrich(
  companyId: number,
  preferDomain: string | null,
): Promise<MappedEnrichment | null> {
  const raw = await cdPostV2("/company/enrich", {
    crustdata_company_ids: [companyId],
    fields: [...ENRICH_FIELDS],
  });
  const match = matchesOf(firstResult(raw))[0];
  if (!match) {
    console.warn("[company-enrichment] enrich returned no match", { companyId });
    return null;
  }
  console.log("[company-enrichment] enrichment groups:", Object.keys(match.company_data ?? {}));
  return mapEnrichment(match.company_data, preferDomain);
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
  const d = await cdPostV2(
    "/job/search",
    {
      filters: {
        op: "and",
        conditions: [{ field: "company_id", op: "in", value: companyIds }],
      },
      sorts: [{ field: "date_added", order: "desc" }],
      limit: 50,
    },
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

  console.log(`[jobs] entity_ids=${companyIds.length} got=${jobs.length} total=${total}`);
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
  const side = direction === "hires" ? "current" : "past";
  const dateField = direction === "hires" ? "start_date" : "end_date";

  const raw = await cdPostV2("/person/search", {
    filters: {
      op: "and",
      conditions: [
        { field: `experience.employment_details.${side}.company_id`, type: "in", value: companyIds },
        { field: `experience.employment_details.${side}.${dateField}`, type: "=>", value: sinceDate },
      ],
    },
    limit: 50,
    fields: [
      "basic_profile.name",
      "basic_profile.first_name",
      "basic_profile.last_name",
      "basic_profile.headline",
      "basic_profile.profile_picture_permalink",
      "experience.employment_details.current",
      "experience.employment_details.past",
      "social_handles.professional_network_identifier.profile_url",
      "crustdata_person_id",
    ],
  });
  const results: any[] = raw?.profiles ?? raw?.data ?? raw?.results ?? [];
  console.log(
    `[talent-flow ${direction}] entity_ids=${companyIds.length} since=${sinceDate} got=${results.length}`,
  );
  const targetIds = idSet(companyIds);
  return results.map((person) => mapTalentFlowPerson(person, targetIds, direction));
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
  linkedin_logo_url: string | null;
  company_website_domain: string | null;
  headcount: number | null;
}

/**
 * Resolve competitor display data with ONE /company/enrich call: the v2
 * endpoint accepts several domains per request and returns basic_info +
 * headcount for each, so no per-domain identify round-trips.
 */
async function resolveCompetitorsByDomain(domains: string[]): Promise<Competitor[]> {
  if (!domains?.length) return [];
  const cleaned = [...new Set(
    domains.map((d) => String(d || "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0]).filter((d) => d.includes(".")),
  )].slice(0, 6);
  if (!cleaned.length) return [];

  const raw = await cdPostV2("/company/enrich", { domains: cleaned, fields: ["basic_info", "headcount"] });
  const results: any[] = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const out: Competitor[] = [];
  for (const r of results) {
    const m = matchesOf(r)[0];
    const b = m?.company_data?.basic_info ?? null;
    const id = b?.crustdata_company_id ?? m?.company_data?.crustdata_company_id;
    if (typeof id !== "number") continue;
    const total = m?.company_data?.headcount?.total;
    out.push({
      company_id: id,
      company_name: (b?.name as string) || String(r?.matched_on ?? ""),
      linkedin_profile_url: (b?.professional_network_url as string) ?? null,
      linkedin_logo_url: (b?.logo_permalink as string) ?? null,
      company_website_domain: (b?.primary_domain as string) ?? (r?.matched_on as string) ?? null,
      headcount: typeof total === "number" ? total : null,
    });
  }
  return out;
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

    // Cache check (7 days, schema_version 12)
    try {
      const { data: cached } = await supabase
        .from("company_enrichment_cache")
        .select("data, created_at")
        .eq("cache_key", cacheKey)
        .maybeSingle();

      if (cached?.data && (cached.data as any)?.schema_version === 12) {
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
      enrich(primaryId, company_domain ?? identified?.company_website_domain ?? null),
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

    // Step 4 — competitors (v2 returns domain lists under competitors.*)
    const competitors = await resolveCompetitorsByDomain(enrichment?.competitor_domains ?? []);

    const company = {
      schema_version: 12 as const,
      company_id: primaryId,
      crustdata_entity_ids: allIds,
      company_name:
        enrichment?.company_name ||
        identified?.company_name ||
        company_name ||
        canonical,
      company_website_domain:
        enrichment?.company_website_domain ||
        identified?.company_website_domain ||
        company_domain ||
        null,
      linkedin_profile_url:
        enrichment?.linkedin_profile_url ||
        identified?.linkedin_profile_url ||
        null,
      linkedin_logo_url: enrichment?.linkedin_logo_url ?? null,
      hq_city: enrichment?.hq_city ?? identified?.hq_city ?? null,
      hq_state: enrichment?.hq_state ?? null,
      hq_country: enrichment?.hq_country ?? identified?.hq_country ?? null,
      headquarters: enrichment?.headquarters ?? null,
      industry: enrichment?.industry ?? null,
      description: enrichment?.description ?? null,
      year_founded: enrichment?.year_founded ?? null,
      employee_count_range: enrichment?.employee_count_range ?? null,
      company_type: enrichment?.company_type ?? null,

      headcount: enrichment?.headcount ?? null,
      glassdoor: enrichment?.glassdoor ?? null,
      g2: enrichment?.g2 ?? null,
      web_traffic: enrichment?.web_traffic ?? null,
      funding: enrichment?.funding ?? null,
      cxos: enrichment?.cxos ?? [],
      decision_makers: enrichment?.decision_makers ?? [],
      founders: enrichment?.founders ?? [],

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
