import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { PDL_BASE } from "./config.ts";
import { parseQueryToFilters, type ParsedFilters } from "./parse-query.ts";
import { filtersToSQL } from "./build-pdl-query.ts";
import { transformSearchResults, generateRelevanceSummaries } from "./format-results.ts";
import {
  generateCacheKey,
  getCachedSearch,
  setCachedSearch,
  getCachedEnrichment,
  setCachedEnrichment,
} from "./cache.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PDL_API_KEY = Deno.env.get("PDL_API_KEY")!;
const PDL_PREVIEW_API_KEY = Deno.env.get("PDL_PREVIEW_API_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

interface SearchRequest {
  action?: "search" | "enrich_person" | "enrich_company" | "parse_filters" | "search_with_filters";
  query?: string;
  size?: number;
  from?: number;
  filters?: ParsedFilters;
  linkedin_url?: string;
  email?: string;
  company_name?: string;
  company_website?: string;
}

// ─── PDL API calls ────────────────────────────────────────────────────────────

async function searchPDL(sql: string, size: number, from: number = 0) {
  console.log("PDL SQL:", sql, "size:", size, "from:", from);
  const body: Record<string, unknown> = { sql, size, pretty: true, dataset: "all" };
  if (from > 0) body.from = from;

  const res = await fetch(`${PDL_BASE}/person/search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-api-key": PDL_PREVIEW_API_KEY,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    if (res.status === 404) return { data: [], total: 0 };
    throw new Error(`PDL Search error (${res.status}): ${errText}`);
  }
  return await res.json();
}

async function enrichPerson(params: { linkedin_url?: string; email?: string }) {
  // Check enrichment cache first
  const cached = await getCachedEnrichment(undefined, params.linkedin_url);
  if (cached) return cached;

  const queryParams = new URLSearchParams();
  if (params.linkedin_url) queryParams.set("profile", params.linkedin_url);
  if (params.email) queryParams.set("email", params.email);
  queryParams.set("pretty", "true");

  const res = await fetch(`${PDL_BASE}/person/enrich?${queryParams.toString()}`, {
    headers: { "X-api-key": PDL_API_KEY },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`PDL Person Enrich error (${res.status}): ${errText}`);
  }

  const result = await res.json();

  // Cache the enrichment result
  await setCachedEnrichment(
    result.id || null,
    params.linkedin_url || null,
    result
  );

  return result;
}

async function enrichCompany(params: { company_name?: string; company_website?: string }) {
  const queryParams = new URLSearchParams();
  if (params.company_name) queryParams.set("name", params.company_name);
  if (params.company_website) queryParams.set("website", params.company_website);
  queryParams.set("pretty", "true");

  const res = await fetch(`${PDL_BASE}/company/enrich?${queryParams.toString()}`, {
    headers: { "X-api-key": PDL_API_KEY },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`PDL Company Enrich error (${res.status}): ${errText}`);
  }
  return await res.json();
}

// ─── Request handler ──────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: SearchRequest = await req.json();
    const action = body.action || "search";

    // ── Enrich person ─────────────────────────────────────────────────────────
    if (action === "enrich_person") {
      if (!body.linkedin_url && !body.email) {
        return new Response(
          JSON.stringify({ error: "linkedin_url or email required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const result = await enrichPerson({ linkedin_url: body.linkedin_url, email: body.email });
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Enrich company ────────────────────────────────────────────────────────
    if (action === "enrich_company") {
      if (!body.company_name && !body.company_website) {
        return new Response(
          JSON.stringify({ error: "company_name or company_website required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const result = await enrichCompany({ company_name: body.company_name, company_website: body.company_website });
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Parse filters (step 1 of 2-step search) ───────────────────────────────
    if (action === "parse_filters") {
      const { query } = body;
      if (!query || query.trim().length === 0) {
        return new Response(
          JSON.stringify({ error: "Search query is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const filters = await parseQueryToFilters(query, LOVABLE_API_KEY);
      console.log("Parsed filters:", JSON.stringify(filters));

      const sql = filtersToSQL(filters);
      console.log("Generated SQL:", sql);

      return new Response(
        JSON.stringify({ filters, total: null, sql_used: sql }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Search with filters (step 2 of 2-step search) ─────────────────────────
    if (action === "search_with_filters") {
      const { filters, size = 15, from = 0 } = body;
      if (!filters) {
        return new Response(
          JSON.stringify({ error: "Filters are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const sql = filtersToSQL(filters);
      console.log("Search SQL:", sql);

      // Check cache first
      const cacheKey = await generateCacheKey(filters as unknown as Record<string, unknown>, size, from);
      const cached = await getCachedSearch(cacheKey);

      let candidates;
      let total: number;

      if (cached) {
        console.log("Using cached results");
        candidates = cached.response as any[];
        total = cached.total_count;
      } else {
        const pdlResults = await searchPDL(sql, size, from);
        console.log("PDL returned", pdlResults.total, "total results");
        total = pdlResults.total || 0;

        candidates = transformSearchResults(pdlResults, filters);

        // Generate AI relevance summaries
        const queryText = body.query || [
          ...filters.job_titles,
          ...filters.specialties,
          ...filters.locations,
        ].join(", ");

        candidates = await generateRelevanceSummaries(
          candidates,
          queryText,
          LOVABLE_API_KEY
        );

        // Cache the results
        await setCachedSearch(cacheKey, queryText, filters as unknown as Record<string, unknown>, candidates, total);
      }

      return new Response(
        JSON.stringify({ candidates, total, sql_used: sql }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Legacy single-step search ─────────────────────────────────────────────
    const { query, size = 15 } = body;
    if (!query || query.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "Search query is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const filters = await parseQueryToFilters(query, LOVABLE_API_KEY);
    const sql = filtersToSQL(filters);
    console.log("Legacy SQL:", sql);

    const pdlResults = await searchPDL(sql, size);
    console.log("PDL returned", pdlResults.total, "total results");

    const candidates = transformSearchResults(pdlResults, filters);

    return new Response(
      JSON.stringify({ candidates, total: pdlResults.total || 0, sql_used: sql, filters }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("PDL error:", error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
