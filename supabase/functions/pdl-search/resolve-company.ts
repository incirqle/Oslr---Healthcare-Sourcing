/**
 * resolve-company.ts — Unified health system entity resolver.
 *
 * Runs BEFORE both PDL and CrustData searches. Resolves a company name into:
 * - CrustData entity IDs (for company_id filtering)
 * - Website domains (for domain fallback filtering)
 * - All known name variants (for PDL name matching)
 *
 * Uses CrustData Company Identify API (FREE, 0 credits).
 * Results cached in Supabase `company_entity_cache` table permanently.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { HEALTH_SYSTEM_DIVISIONS, COMPANY_ALIASES } from "./config.ts";

const CRUSTDATA_BASE_URL = "https://api.crustdata.com";

export interface ResolvedCompany {
  canonical_name: string;
  entity_ids: number[];
  academic_ids: number[];
  all_ids: number[];
  domains: string[];
  all_names: string[];
  linkedin_urls: string[];
  resolved_at: string;
}

/* ------------------------------------------------------------------ */
/* Pre-mapped health systems (known good from live testing)             */
/* ------------------------------------------------------------------ */

const PREMAPPED_SYSTEMS: Record<string, ResolvedCompany> = {
  "uchealth": {
    canonical_name: "UCHealth",
    entity_ids: [1304813, 6259524, 6524064, 9255529, 12929305, 10791937, 9819138, 6644127],
    academic_ids: [670107, 6041104, 2056710],
    all_ids: [1304813, 6259524, 6524064, 9255529, 12929305, 10791937, 9819138, 6644127, 670107, 6041104, 2056710],
    domains: ["uchealth.org", "cuanschutz.edu", "CUmedicine.us"],
    all_names: [
      "uchealth", "uc health", "university of colorado health",
      "university of colorado hospital", "uch", "parkview medical center",
      "uchealth yampa valley", "uchealth greeley", "uchealth longmont",
      "uchealth broomfield", "university of colorado anschutz",
      "university of colorado school of medicine", "university of colorado medicine",
    ],
    linkedin_urls: [
      "https://www.linkedin.com/company/uchealth",
      "https://www.linkedin.com/company/cuanschutz",
      "https://www.linkedin.com/company/university-of-colorado-school-of-medicine",
      "https://www.linkedin.com/company/university-of-colorado-medicine",
    ],
    resolved_at: "2026-06-02",
  },
};

/* ------------------------------------------------------------------ */
/* Live resolution via CrustData Identify API (free)                    */
/* ------------------------------------------------------------------ */

interface IdentifyResult {
  company_id?: number;
  company_name?: string;
  linkedin_profile_url?: string | null;
  company_website_domain?: string | null;
}

async function identifyByDomain(domain: string): Promise<IdentifyResult[]> {
  const apiKey = Deno.env.get("CRUSTDATA_API_KEY");
  if (!apiKey) return [];
  try {
    const res = await fetch(`${CRUSTDATA_BASE_URL}/screener/identify`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query_company_website: domain, count: 25 }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [data];
  } catch { return []; }
}

async function identifyByName(name: string): Promise<IdentifyResult[]> {
  const apiKey = Deno.env.get("CRUSTDATA_API_KEY");
  if (!apiKey) return [];
  try {
    const res = await fetch(`${CRUSTDATA_BASE_URL}/screener/identify`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query_company_name: name, exact_match: false, count: 10 }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [data];
  } catch { return []; }
}

/* ------------------------------------------------------------------ */
/* Main resolver                                                        */
/* ------------------------------------------------------------------ */

export async function resolveHealthSystem(
  companyName: string,
  supabaseClient: ReturnType<typeof createClient>
): Promise<ResolvedCompany> {
  const lower = companyName.toLowerCase().trim();
  const canonical = COMPANY_ALIASES[lower] ?? lower;

  // 1. Check pre-mapped systems
  if (PREMAPPED_SYSTEMS[canonical]) {
    console.log(`[RESOLVE] Pre-mapped: "${companyName}" → ${PREMAPPED_SYSTEMS[canonical].canonical_name} (${PREMAPPED_SYSTEMS[canonical].all_ids.length} entities)`);
    return PREMAPPED_SYSTEMS[canonical];
  }

  // 2. Check Supabase cache
  try {
    const { data: cached } = await supabaseClient
      .from("company_entity_cache")
      .select("data")
      .eq("canonical_name", canonical)
      .maybeSingle();
    if (cached?.data) {
      const resolved = cached.data as ResolvedCompany;
      console.log(`[RESOLVE] Cache hit: "${companyName}" → ${resolved.all_ids.length} entities`);
      return resolved;
    }
  } catch { /* cache miss */ }

  // 3. Live resolution via CrustData Identify API (free)
  console.log(`[RESOLVE] Live resolving: "${companyName}"`);

  const entityIds: number[] = [];
  const domains = new Set<string>();
  const allNames = new Set<string>([lower, canonical]);
  const linkedinUrls: string[] = [];

  const nameResults = await identifyByName(companyName);
  for (const r of nameResults) {
    if (r.company_id) entityIds.push(r.company_id);
    if (r.company_website_domain) domains.add(r.company_website_domain);
    if (r.company_name) allNames.add(r.company_name.toLowerCase());
    if (r.linkedin_profile_url) linkedinUrls.push(r.linkedin_profile_url);
  }

  for (const domain of [...domains]) {
    const domainResults = await identifyByDomain(domain);
    for (const r of domainResults) {
      if (r.company_id && !entityIds.includes(r.company_id)) entityIds.push(r.company_id);
      if (r.company_name) allNames.add(r.company_name.toLowerCase());
      if (r.linkedin_profile_url && !linkedinUrls.includes(r.linkedin_profile_url)) {
        linkedinUrls.push(r.linkedin_profile_url);
      }
    }
  }

  const divisions = HEALTH_SYSTEM_DIVISIONS[canonical] ?? [];
  for (const d of divisions) allNames.add(d.toLowerCase());

  const resolved: ResolvedCompany = {
    canonical_name: companyName,
    entity_ids: entityIds,
    academic_ids: [],
    all_ids: entityIds,
    domains: [...domains],
    all_names: [...allNames],
    linkedin_urls: linkedinUrls,
    resolved_at: new Date().toISOString(),
  };

  // 4. Cache permanently
  try {
    await supabaseClient.from("company_entity_cache").upsert({
      canonical_name: canonical,
      data: resolved,
    });
  } catch { /* non-fatal */ }

  console.log(`[RESOLVE] Resolved "${companyName}": ${entityIds.length} entity IDs, ${domains.size} domains, ${allNames.size} name variants`);
  return resolved;
}
