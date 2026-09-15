import "./lib/crustdata-killswitch.ts";
//
// cache.ts — Crustdata search caching + v2 profile normalization for the
// clinician engine. Ported from search-talent/fetch-crustdata-results.ts
// (the legacy PersonDB wrapper and the contact-enrichment cache path are not
// ported — nothing in this engine calls them).
//
// Cache rows live in the service-role crustdata_cache table (added by the
// search-clinicians migration). Keys are versioned upstream
// (credit-budget.ts buildSearchCacheKey hashes criteria + limit + fields
// under the "clin:" prefix), so a deploy that changes filter shape or the
// projection misses old rows instead of serving a stale build's results for
// a full TTL (blueprint §9).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export const SEARCH_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours
export const ENRICHMENT_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function getServiceClient() {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  return createClient(url, service, { auth: { persistSession: false } });
}

export interface CrustDataSearchResult {
  // deno-lint-ignore no-explicit-any
  profiles: any[];
  total_count: number;
  next_cursor: string | null;
}

/** v2-nested profile → flat card shape the downstream layers consume. */
// deno-lint-ignore no-explicit-any
export function normalizeCrustDataV2Profile(p: any): any {
  if (!p || typeof p !== "object") return p;

  const basic = p.basic_profile ?? {};
  const location = basic.location ?? p.professional_network?.location ?? {};
  const employment = p.experience?.employment_details ?? {};
  const current = Array.isArray(employment.current) ? employment.current : [];
  const past = Array.isArray(employment.past) ? employment.past : [];
  const personId =
    p.person_id ??
    p.crustdata_person_id ??
    p.id ??
    basic.person_id ??
    basic.id ??
    null;
  const profileUrl =
    p.linkedin_profile_url ??
    p.profile_url ??
    p.professional_network_profile_url ??
    p.professional_network?.profile_url ??
    p.social_handles?.professional_network_identifier?.profile_url ??
    basic.professional_network_profile_url ??
    null;

  // deno-lint-ignore no-explicit-any
  const currentEmployers = current.map((e: any) => ({
    ...e,
    name: e.name ?? e.company_name ?? e.company ?? null,
    company: e.company ?? e.company_name ?? e.name ?? null,
    title: e.title ?? null,
    company_industries: e.company_industries ?? [],
    company_logo_url: e.company_logo_url ?? e.company_profile_picture_permalink ?? null,
    logo_url: e.logo_url ?? e.company_profile_picture_permalink ?? null,
    company_website_domain: e.company_website_domain ?? e.company_website ?? null,
    company_website: e.company_website ?? e.company_website_domain ?? null,
  }));

  const educationBackground = Array.isArray(p.education?.schools)
    // deno-lint-ignore no-explicit-any
    ? p.education.schools.map((edu: any) => ({
        ...edu,
        institute_name: edu.school ?? edu.institute_name ?? edu.school_name ?? null,
        school_name: edu.school ?? edu.school_name ?? edu.institute_name ?? null,
        degree_name: edu.degree ?? edu.degree_name ?? null,
        field_of_study: edu.field_of_study ?? null,
        institute_logo_url: edu.institute_logo_permalink ?? edu.institute_logo_url ?? null,
      }))
    : (Array.isArray(p.education_background) ? p.education_background : []);

  return {
    ...p,
    person_id: personId,
    linkedin_profile_url: profileUrl,
    name: p.name ?? basic.name ?? basic.professional_network_name ?? null,
    headline: p.headline ?? basic.headline ?? basic.current_title ?? null,
    summary: p.summary ?? basic.summary ?? null,
    region: p.region ?? location.full_location ?? location.raw ?? basic.location ?? null,
    location_city: p.location_city ?? location.city ?? null,
    location_state: p.location_state ?? location.state ?? null,
    current_employers: currentEmployers,
    past_employers: past,
    education_background: educationBackground,
    contact: p.contact ?? {},
  };
}

export async function getCrustDataCache(
  cacheKey: string,
  ttlMs: number = SEARCH_TTL_MS,
): Promise<CrustDataSearchResult | null> {
  const sb = getServiceClient();
  const { data, error } = await sb
    .from("crustdata_cache")
    .select("total, data, next_cursor, created_at")
    .eq("cache_key", cacheKey)
    .maybeSingle();
  if (error || !data) return null;
  const age = Date.now() - new Date(data.created_at as string).getTime();
  if (age > ttlMs) return null;
  return {
    // deno-lint-ignore no-explicit-any
    profiles: (data.data as any[]) ?? [],
    total_count: data.total as number,
    next_cursor: (data.next_cursor as string | null) ?? null,
  };
}

export async function setCrustDataCache(
  cacheKey: string,
  total: number,
  // deno-lint-ignore no-explicit-any
  data: any[],
  nextCursor: string | null,
): Promise<void> {
  const sb = getServiceClient();
  await sb.from("crustdata_cache").upsert({
    cache_key: cacheKey,
    total,
    data,
    next_cursor: nextCursor,
    created_at: new Date().toISOString(),
  });
}
