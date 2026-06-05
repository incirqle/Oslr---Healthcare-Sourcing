import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */

export interface HeadcountTimeseriesPoint {
  date: string;
  employee_count: number;
}

export interface HeadcountGrowth {
  mom?: number | null;
  qoq?: number | null;
  six_months?: number | null;
  yoy?: number | null;
  two_years?: number | null;
}

export interface HeadcountData {
  linkedin_headcount?: number | null;
  linkedin_headcount_total_growth_percent?: HeadcountGrowth | null;
  linkedin_headcount_total_growth_absolute?: HeadcountGrowth | null;
  linkedin_headcount_timeseries?: HeadcountTimeseriesPoint[] | null;
  linkedin_headcount_by_role_absolute?: Record<string, number> | null;
  linkedin_headcount_by_role_percent?: Record<string, number> | null;
  linkedin_headcount_by_role_six_months_growth_percent?: Record<string, number> | null;
  linkedin_headcount_by_role_yoy_growth_percent?: Record<string, number> | null;
  linkedin_headcount_by_region_absolute?: Record<string, number> | null;
  linkedin_headcount_by_region_percent?: Record<string, number> | null;
  linkedin_headcount_by_skill_absolute?: Record<string, number> | null;
  linkedin_headcount_by_skill_percent?: Record<string, number> | null;
  linkedin_headcount_by_function_timeseries?: {
    CURRENT_FUNCTION?: Record<string, HeadcountTimeseriesPoint[]>;
  } | null;
}

export interface GlassdoorData {
  overall_rating?: number | null;
  review_count?: number | null;
  ceo_approval?: number | null;
  business_outlook?: number | null;
  recommend_to_friend?: number | null;
}

export interface WebTrafficData {
  monthly_visitors?: number | null;
  growth_mom_percent?: number | null;
}

export interface LeaderEntry {
  name: string;
  title: string;
  linkedin_url?: string | null;
  profile_picture_url?: string | null;
}

export interface JobListing {
  title: string;
  location_text: string | null;
  workplace_type: string | null;
  date_added: string | null;
  url: string | null;
  category: string | null;
}

export interface CompetitorEntry {
  company_id: number;
  company_name: string;
  linkedin_profile_url: string | null;
  linkedin_logo_url?: string | null;
  company_website_domain: string | null;
  headcount: number | null;
}

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

export interface TalentFlowAggregate {
  hires: TalentFlowPerson[];
  departures: TalentFlowPerson[];
  hire_count: number;
  departure_count: number;
  top_hire_sources: { company: string; count: number; linkedin_url: string | null }[];
  top_departure_destinations: { company: string; count: number; linkedin_url: string | null }[];
}

export interface CompanyIntel {
  schema_version?: 2;
  company_id: number;
  company_name: string;
  company_website_domain: string | null;
  linkedin_profile_url: string | null;
  linkedin_logo_url: string | null;
  hq_city: string | null;
  hq_state: string | null;
  hq_country: string | null;
  industry: string | null;
  description: string | null;
  year_founded: string | number | null;

  headcount: HeadcountData | null;
  glassdoor: GlassdoorData | null;
  g2: Record<string, unknown> | null;
  web_traffic: WebTrafficData | null;
  funding: Record<string, unknown> | null;
  cxos: LeaderEntry[];
  decision_makers: LeaderEntry[];

  jobs: JobListing[];
  jobs_total: number;

  competitors: CompetitorEntry[];

  talent_flow?: TalentFlowAggregate | null;


  cached?: boolean;
  enriched_at?: string;
}

/* ------------------------------------------------------------------ */
/* Hook                                                                 */
/* ------------------------------------------------------------------ */

export function useCompanyEnrichment(
  companyName: string | null | undefined,
  companyDomain?: string | null,
  options?: {
    crustdataEntityIds?: number[] | null;
    canonicalCompanyName?: string | null;
  },
) {
  const [data, setData] = useState<CompanyIntel | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const idsKey = (options?.crustdataEntityIds ?? []).slice().sort().join(",");
  const canonical = options?.canonicalCompanyName ?? null;

  useEffect(() => {
    if (!companyName) {
      setData(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const { data: res, error: invokeErr } = await supabase.functions.invoke(
          "company-enrichment",
          {
            body: {
              company_name: companyName,
              company_domain: companyDomain ?? null,
              crustdata_entity_ids: options?.crustdataEntityIds ?? null,
              canonical_company_name: canonical,
            },
          },
        );
        if (cancelled) return;
        if (invokeErr) {
          setError(invokeErr.message);
          setData(null);
        } else {
          setData((res as { company: CompanyIntel | null })?.company ?? null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyName, companyDomain, idsKey, canonical]);

  return { data, loading, error };
}
