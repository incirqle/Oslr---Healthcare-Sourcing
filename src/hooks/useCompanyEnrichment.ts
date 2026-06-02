import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface CompanyEnrichment {
  company_id: number;
  company_name: string;
  company_website_domain: string | null;
  linkedin_profile_url: string | null;
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
  cxos: { name: string; linkedin_url: string | null; title: string }[] | null;
  decision_makers:
    | { name: string; linkedin_url: string | null; title: string }[]
    | null;
  web_traffic: {
    monthly_visitors: number | null;
    growth_mom_percent: number | null;
  } | null;
}

/**
 * Fetches CrustData company enrichment for a given employer.
 *
 * Pass `companyDomain` whenever known (e.g. "uchealth.org") — it makes
 * Crustdata's identify step far more reliable for ambiguous names like
 * "UCHealth" and is used as the cache key when present.
 */
export function useCompanyEnrichment(
  companyName: string | null | undefined,
  companyDomain?: string | null,
) {
  const [data, setData] = useState<CompanyEnrichment | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
            },
          },
        );
        if (cancelled) return;
        if (invokeErr) {
          setError(invokeErr.message);
          setData(null);
        } else {
          setData((res as { company: CompanyEnrichment | null })?.company ?? null);
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
  }, [companyName, companyDomain]);

  return { data, loading, error };
}
