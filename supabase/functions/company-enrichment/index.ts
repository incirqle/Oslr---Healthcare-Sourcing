/**
 * company-enrichment edge function — frontend-facing wrapper around
 * CrustData company enrichment. Called from the candidate drawer when the
 * user clicks "Look up" so we can show employer intel (headcount,
 * Glassdoor, leadership, web traffic).
 *
 * Cached server-side (7d) in company_enrichment_cache, keyed on the
 * canonical domain when available, otherwise the company name.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCompanyEnrichment } from "./enrich-company.ts";

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
    const body = await req.json().catch(() => ({}));
    const company_name = typeof body?.company_name === "string" ? body.company_name : null;
    const company_domain = typeof body?.company_domain === "string" ? body.company_domain : null;

    if (!company_name) {
      return new Response(
        JSON.stringify({ error: "company_name is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const enrichment = await getCompanyEnrichment(company_name, supabase, company_domain);

    return new Response(JSON.stringify({ company: enrichment }), {
      status: 200,
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
