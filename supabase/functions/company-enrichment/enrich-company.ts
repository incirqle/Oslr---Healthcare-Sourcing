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
  glassdoor: { overall_rating: number | null; review_count: number | null } | null;
  cxos: { name: string; linkedin_url: string | null; title: string }[] | null;
  decision_makers: { name: string; linkedin_url: string | null; title: string }[] | null;
  web_traffic: { monthly_visitors: number | null; growth_mom_percent: number | null } | null;
}

function normalizeDomain(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim().toLowerCase();
  if (!s) return null;
  const host = s
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0]
    .split("?")[0];
  return host && host.includes(".") ? host : null;
}

/**
 * Identify a company via Crustdata. When a website domain is known we send
 * it under several common parameter names so identification succeeds for
 * ambiguous names like "UCHealth".
 */
async function identifyCompany(
  companyName: string,
  companyDomain: string | null,
): Promise<{ company_id: number; linkedin_profile_url: string | null } | null> {
  const apiKey = Deno.env.get("CRUSTDATA_API_KEY");
  if (!apiKey) {
    console.warn("[Company Enrich] CRUSTDATA_API_KEY missing");
    return null;
  }

  // Crustdata's /identify accepts exactly one of:
  // query_company_name | query_company_website | query_company_linkedin_url | query_company_id
  // Prefer domain when we have it (much higher hit rate for ambiguous names).
  const body: Record<string, unknown> = companyDomain
    ? { query_company_website: companyDomain }
    : { query_company_name: companyName, exact_match: false };

  const res = await fetch(`${CRUSTDATA_BASE_URL}/screener/identify`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    console.error(
      `[Company Enrich] Identify ${res.status} for "${companyName}" (domain=${companyDomain}): ${await res.text()}`,
    );
    return null;
  }
  const raw = await res.json();
  console.log(`[Company Enrich] Identify response: ${JSON.stringify(raw).slice(0, 400)}`);
  // Crustdata /identify returns an array of matches; take the first.
  const data = Array.isArray(raw) ? raw[0] : raw;
  if (!data?.company_id) return null;
  return {
    company_id: data.company_id,
    linkedin_profile_url: data.linkedin_profile_url || null,
  };
}

async function fetchCompanyEnrichment(companyId: number): Promise<CompanyEnrichment | null> {
  const apiKey = Deno.env.get("CRUSTDATA_API_KEY");
  if (!apiKey) return null;

  const fields = "headcount,glassdoor,cxos,decision_makers,web_traffic";
  const res = await fetch(
    `${CRUSTDATA_BASE_URL}/screener/company?company_id=${companyId}&fields=${fields}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    },
  );

  if (!res.ok) {
    console.error(`[Company Enrich] Detail ${res.status}: ${await res.text()}`);
    return null;
  }

  // Crustdata /screener/company returns an array of company records — unwrap.
  const raw = await res.json();
  const record = Array.isArray(raw) ? raw[0] : raw;
  if (!record || typeof record !== "object") return null;
  return record as CompanyEnrichment;
}

/**
 * Cache-aware enrichment lookup.
 *
 * Cache key prefers the canonical domain when available so different
 * spellings ("UCHealth", "UC Health", "uchealth") all share one row and
 * we don't repeatedly burn Crustdata credits for the same employer.
 */
export async function getCompanyEnrichment(
  companyName: string,
  supabaseClient: ReturnType<typeof createClient>,
  companyDomain?: string | null,
): Promise<CompanyEnrichment | null> {
  if (!companyName) return null;

  const normalizedDomain = normalizeDomain(companyDomain ?? null);
  const cacheKey = normalizedDomain ?? companyName.toLowerCase().trim();

  // 1. Domain (or name) cache hit
  const { data: cached } = await supabaseClient
    .from("company_enrichment_cache")
    .select("data, created_at")
    .eq("cache_key", cacheKey)
    .maybeSingle();

  if (cached) {
    const age = Date.now() - new Date(cached.created_at as string).getTime();
    if (age < 7 * 24 * 60 * 60 * 1000) {
      console.log(`[Company Enrich] Cache hit (${cacheKey})`);
      return cached.data as unknown as CompanyEnrichment;
    }
  }

  // 2. Secondary name cache hit (when caller passed a domain but only a
  // name-keyed row exists from earlier lookups)
  if (normalizedDomain) {
    const nameKey = companyName.toLowerCase().trim();
    const { data: nameCached } = await supabaseClient
      .from("company_enrichment_cache")
      .select("data, created_at")
      .eq("cache_key", nameKey)
      .maybeSingle();
    if (nameCached) {
      const age = Date.now() - new Date(nameCached.created_at as string).getTime();
      if (age < 7 * 24 * 60 * 60 * 1000) {
        console.log(`[Company Enrich] Cache hit via name (${nameKey})`);
        return nameCached.data as unknown as CompanyEnrichment;
      }
    }
  }

  console.log(
    `[Company Enrich] Cache miss, calling Crustdata: name="${companyName}" domain=${normalizedDomain}`,
  );

  const identified = await identifyCompany(companyName, normalizedDomain);
  if (!identified) {
    console.log(
      `[Company Enrich] Could not identify: name="${companyName}" domain=${normalizedDomain}`,
    );
    return null;
  }

  const enrichment = await fetchCompanyEnrichment(identified.company_id);
  if (!enrichment) return null;

  await supabaseClient.from("company_enrichment_cache").upsert({
    cache_key: cacheKey,
    company_id: identified.company_id,
    data: enrichment,
    created_at: new Date().toISOString(),
  });

  return enrichment;
}
