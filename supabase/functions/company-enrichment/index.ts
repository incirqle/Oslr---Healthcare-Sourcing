/**
 * company-enrichment edge function — full company intelligence endpoint.
 *
 * Called from the candidate drawer when the user opens the Company Intel
 * view. Returns the rich payload required for the "Company insights" +
 * "Hiring activity" tabs.
 *
 * Data sources (all CrustData):
 *   1. POST /screener/identify          — FREE, resolves name → company_id
 *   2. GET  /screener/company?fields=…  — 1 credit, full enrichment
 *   3. POST /job/search                 — 1 credit, open jobs
 *   4. POST /screener/identify (batched) — FREE, resolves competitor ids
 *
 * Cached 7 days in company_enrichment_cache, keyed on the canonical
 * company name (or domain when provided).
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
/* Step 1 — identify                                                    */
/* ------------------------------------------------------------------ */

interface Identified {
  company_id: number;
  company_name: string;
  linkedin_profile_url: string | null;
  company_website_domain: string | null;
  headcount: number | null;
  hq_city: string | null;
  hq_country: string | null;
}

async function identifyByName(name: string, domain?: string | null): Promise<Identified | null> {
  const payload: Record<string, unknown> = {
    query_company_name: name,
    exact_match: false,
  };
  if (domain) payload.query_company_website_domain = domain;
  const d = await cdPost("/screener/identify", payload);
  if (!d?.company_id) return null;
  return {
    company_id: d.company_id,
    company_name: d.company_name || name,
    linkedin_profile_url: d.linkedin_profile_url ?? null,
    company_website_domain: d.company_website_domain ?? null,
    headcount: d.headcount ?? null,
    hq_city: d.hq_city ?? null,
    hq_country: d.hq_country ?? null,
  };
}

/* ------------------------------------------------------------------ */
/* Step 2 — enrichment                                                  */
/* ------------------------------------------------------------------ */

async function enrich(companyId: number): Promise<Record<string, unknown> | null> {
  const fields =
    "headcount,funding_and_investment,glassdoor,g2,cxos,decision_makers,web_traffic";
  return await cdGet(`/screener/company?company_id=${companyId}&fields=${fields}`);
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

async function fetchJobs(companyId: number): Promise<{ jobs: JobListing[]; total: number }> {
  const d = await cdPost(
    "/job/search",
    {
      filters: {
        op: "and",
        conditions: [{ column: "company_id", type: "in", value: [companyId] }],
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
/* Step 4 — competitor resolution                                       */
/* ------------------------------------------------------------------ */

interface Competitor {
  company_id: number;
  company_name: string;
  linkedin_profile_url: string | null;
  company_website_domain: string | null;
  headcount: number | null;
}

async function resolveCompetitors(ids: number[]): Promise<Competitor[]> {
  if (!ids?.length) return [];
  const top = ids.slice(0, 6);
  const out = await Promise.all(
    top.map(async (id) => {
      const d = await cdPost("/screener/identify", { query_company_id: id });
      if (!d?.company_id) return null;
      return {
        company_id: d.company_id,
        company_name: d.company_name ?? "Unknown",
        linkedin_profile_url: d.linkedin_profile_url ?? null,
        company_website_domain: d.company_website_domain ?? null,
        headcount: d.headcount ?? null,
      } as Competitor;
    }),
  );
  return out.filter((c): c is Competitor => c !== null);
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

    if (!company_name && !provided_id) {
      return new Response(
        JSON.stringify({ error: "company_name or company_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const cacheKey = (
      company_domain ?? company_name ?? String(provided_id)
    ).toLowerCase().trim();

    // Cache check (7 days)
    try {
      const { data: cached } = await supabase
        .from("company_enrichment_cache")
        .select("data, created_at")
        .eq("cache_key", cacheKey)
        .maybeSingle();

      if (cached?.data && (cached.data as any)?.schema_version === 2) {
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

    // Step 1 — identify
    let companyId = provided_id;
    let identified: Identified | null = null;
    if (!companyId && company_name) {
      identified = await identifyByName(company_name, company_domain);
      if (!identified) {
        return new Response(
          JSON.stringify({ company: null, error: "Company not found" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      companyId = identified.company_id;
    }

    if (!companyId) {
      return new Response(JSON.stringify({ company: null }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Steps 2–3 in parallel
    const [enrichment, jobsResult] = await Promise.all([
      enrich(companyId),
      fetchJobs(companyId),
    ]);

    // Step 4 — competitors
    const competitorIds = (enrichment?.competitor_ids as number[]) ?? [];
    const competitors = await resolveCompetitors(competitorIds);

    const company = {
      schema_version: 2 as const,
      company_id: companyId,
      company_name:
        (enrichment?.company_name as string) ||
        identified?.company_name ||
        company_name,
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
      hq_city: (enrichment?.hq_city as string) ?? identified?.hq_city ?? null,
      hq_state: (enrichment?.hq_state as string) ?? null,
      hq_country:
        (enrichment?.hq_country as string) ?? identified?.hq_country ?? null,
      industry: (enrichment?.linkedin_industry as string) ?? null,
      description:
        (enrichment?.linkedin_company_description as string) ??
        (enrichment?.description as string) ??
        null,
      year_founded: (enrichment?.year_founded as string | number) ?? null,

      // Raw nested objects — frontend slices what it needs
      headcount: enrichment?.headcount ?? null,
      glassdoor: enrichment?.glassdoor ?? null,
      g2: enrichment?.g2 ?? null,
      web_traffic: enrichment?.web_traffic ?? null,
      funding: enrichment?.funding_and_investment ?? null,
      cxos: enrichment?.cxos ?? [],
      decision_makers: enrichment?.decision_makers ?? [],

      jobs: jobsResult.jobs,
      jobs_total: jobsResult.total,

      competitors,

      cached: false,
      enriched_at: new Date().toISOString(),
    };

    // Cache
    try {
      await supabase.from("company_enrichment_cache").upsert({
        cache_key: cacheKey,
        company_id: companyId,
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
