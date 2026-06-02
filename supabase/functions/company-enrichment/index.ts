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
  // Crustdata's /screener/identify accepts EXACTLY ONE of:
  // query_company_name, query_company_website, query_company_linkedin_url,
  // query_company_crunchbase_url, query_company_id.
  // Prefer name when present (best recall on partial matches), otherwise domain.
  const payload: Record<string, unknown> = { exact_match: false };
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
  if (list.length === 0) {
    console.warn("[company-enrichment] identify miss", { name, domain });
    return null;
  }
  const best = pickBestCandidate(list, name, domain ?? null);
  if (!best?.company_id) {
    console.warn("[company-enrichment] identify no usable id", { name, domain });
    return null;
  }
  console.info("[company-enrichment] identified", {
    name,
    chosen_id: best.company_id,
    chosen_name: best.company_name,
    candidates: list.length,
  });
  return {
    company_id: best.company_id,
    company_name: best.company_name || name,
    linkedin_profile_url: best.linkedin_profile_url ?? null,
    company_website_domain: best.company_website_domain ?? null,
    headcount: typeof best.linkedin_headcount === "number" ? best.linkedin_headcount : null,
    hq_city: best.hq_city ?? null,
    hq_country: best.hq_country ?? null,
  };
}

/* ------------------------------------------------------------------ */
/* Step 2 — enrichment                                                  */
/* ------------------------------------------------------------------ */

async function enrich(companyId: number): Promise<Record<string, unknown> | null> {
  // Prefix-only field names hydrate every nested sub-field.
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

      if (cached?.data && (cached.data as any)?.schema_version === 5) {
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

    // Step 4 — competitors (Crustdata returns domain lists, not IDs)
    const compBlock = (enrichment?.competitors as any) ?? {};
    const compDomains: string[] = [
      ...((compBlock?.competitor_website_domains as string[]) ?? []),
      ...((compBlock?.organic_seo_competitors_website_domains as string[]) ?? []),
      ...((compBlock?.paid_seo_competitors_website_domains as string[]) ?? []),
    ];
    // de-dup
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

    const taxonomy = (enrichment?.taxonomy as any) ?? {};

    const company = {
      schema_version: 5 as const,
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
      hq_city: parsedHqCity ?? identified?.hq_city ?? null,
      hq_state: (enrichment?.hq_state as string) ?? null,
      hq_country:
        (enrichment?.hq_country as string) ?? identified?.hq_country ?? null,
      headquarters: hqStr || null,
      industry:
        (taxonomy?.linkedin_industry as string) ??
        (Array.isArray(taxonomy?.linkedin_industries)
          ? (taxonomy.linkedin_industries[0] as string)
          : null) ??
        null,
      description: (enrichment?.linkedin_company_description as string) ?? null,
      year_founded: (enrichment?.year_founded as string | number) ?? null,
      employee_count_range: (enrichment?.employee_count_range as string) ?? null,

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
