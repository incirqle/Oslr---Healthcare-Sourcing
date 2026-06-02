/**
 * enrich-company.ts — CrustData Company Enrichment for candidate detail views.
 *
 * FLOW (triggered when user clicks a candidate):
 * 1. POST /screener/identify (FREE) — resolve company name → company_id
 * 2. GET /screener/company?company_id=<id>&fields=... (1 credit) — full enrichment
 *
 * COST: 1 credit per company. Cached in Supabase (7d) to avoid repeat charges.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CRUSTDATA_BASE_URL = "https://api.crustdata.com";

export interface CompanyEnrichment {
  company_id: number;
  company_name: string;
  company_website_domain: string | null;
  linkedin_profile_url: string | null;
  linkedin_id: number | null;
  hq_city: string | null;
  hq_state: string | null;
  hq_country: string | null;
  description: string | null;
  founded_year: number | null;
  headcount: {
    latest_count: number | null;
    growth_6m_percent: number | null;
    growth_12m_percent: number | null;
    growth_24m_percent: number | null;
    department_breakdown: Record<string, number> | null;
  } | null;
  glassdoor: {
    overall_rating: number | null;
    review_count: number | null;
  } | null;
  cxos: {
    name: string;
    linkedin_url: string | null;
    title: string;
  }[] | null;
  decision_makers: {
    name: string;
    linkedin_url: string | null;
    title: string;
  }[] | null;
  web_traffic: {
    monthly_visitors: number | null;
    growth_mom_percent: number | null;
  } | null;
}

async function identifyCompany(
  companyName: string
): Promise<{ company_id: number; linkedin_profile_url: string | null } | null> {
  const apiKey = Deno.env.get("CRUSTDATA_API_KEY");
  if (!apiKey) return null;

  try {
    const res = await fetch(`${CRUSTDATA_BASE_URL}/screener/identify`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query_company_name: companyName,
        exact_match: false,
      }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.company_id) return null;
    return {
      company_id: data.company_id,
      linkedin_profile_url: data.linkedin_profile_url || null,
    };
  } catch {
    return null;
  }
}

async function fetchCompanyEnrichment(
  companyId: number
): Promise<CompanyEnrichment | null> {
  const apiKey = Deno.env.get("CRUSTDATA_API_KEY");
  if (!apiKey) return null;

  try {
    const fields = "headcount,glassdoor,cxos,decision_makers,web_traffic";
    const res = await fetch(
      `${CRUSTDATA_BASE_URL}/screener/company?company_id=${companyId}&fields=${fields}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!res.ok) {
      console.error(`[Company Enrich] Error ${res.status}: ${await res.text()}`);
      return null;
    }

    return await res.json();
  } catch (err) {
    console.error(`[Company Enrich] Failed:`, err instanceof Error ? err.message : String(err));
    return null;
  }
}

/**
 * Get company enrichment for a candidate's employer.
 * Caches results in Supabase (company_enrichment_cache table) for 7 days.
 */
export async function getCompanyEnrichment(
  companyName: string,
  supabaseClient: ReturnType<typeof createClient>
): Promise<CompanyEnrichment | null> {
  if (!companyName) return null;

  const cacheKey = companyName.toLowerCase().trim();

  try {
    const { data: cached } = await supabaseClient
      .from("company_enrichment_cache")
      .select("data, created_at")
      .eq("cache_key", cacheKey)
      .maybeSingle();

    if (cached) {
      const age = Date.now() - new Date(cached.created_at as string).getTime();
      if (age < 7 * 24 * 60 * 60 * 1000) {
        return cached.data as unknown as CompanyEnrichment;
      }
    }
  } catch {
    // Cache miss — continue to API
  }

  const identified = await identifyCompany(companyName);
  if (!identified) {
    console.log(`[Company Enrich] Could not identify: ${companyName}`);
    return null;
  }

  const enrichment = await fetchCompanyEnrichment(identified.company_id);
  if (!enrichment) return null;

  try {
    await supabaseClient.from("company_enrichment_cache").upsert({
      cache_key: cacheKey,
      company_id: identified.company_id,
      data: enrichment,
      created_at: new Date().toISOString(),
    });
  } catch {
    // non-fatal
  }

  return enrichment;
}
