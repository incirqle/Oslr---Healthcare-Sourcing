/**
 * company-enrichment edge function — frontend-facing wrapper around
 * CrustData company enrichment. Called from the candidate drawer when
 * a user opens a candidate so we can show employer intel (headcount,
 * Glassdoor, CMO/CNO, web traffic).
 *
 * Cached server-side (7d) in company_enrichment_cache. 1 credit per
 * unique company on cache miss.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCompanyEnrichment } from "../pdl-search/enrich-company.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { company_name } = await req.json().catch(() => ({}));

    if (!company_name || typeof company_name !== "string") {
      return new Response(
        JSON.stringify({ error: "company_name is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const enrichment = await getCompanyEnrichment(company_name, supabase);

    return new Response(JSON.stringify({ company: enrichment }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[company-enrichment] Error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
