import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PDL_API_KEY = Deno.env.get("PDL_API_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const PDL_BASE = "https://sandbox.api.peopledatalabs.com/v5";

interface SearchRequest {
  action?: "search" | "enrich_person" | "enrich_company" | "parse_filters" | "search_with_filters";
  query?: string;
  size?: number;
  filters?: ParsedFilters;
  linkedin_url?: string;
  email?: string;
  company_name?: string;
  company_website?: string;
}

interface ParsedFilters {
  job_titles: string[];
  locations: string[];
  companies: string[];
  keywords: string[];
  experience_years?: number | null;
  specialties: string[];
}

async function parseQueryToFilters(naturalLanguage: string): Promise<{ filters: ParsedFilters; sql: string; }> {
  const systemPrompt = `You are a search query parser for healthcare recruiting. Parse the natural language query into structured filters AND a PDL SQL query.

Return JSON with this exact structure:
{
  "filters": {
    "job_titles": ["nurse", "registered nurse"],
    "locations": ["Texas"],
    "companies": [],
    "keywords": ["icu"],
    "experience_years": null,
    "specialties": ["cardiology"]
  },
  "sql": "SELECT * FROM person WHERE job_title LIKE '%nurse%' AND location_region='texas' AND job_title_role='health'"
}

Rules for filters:
- job_titles: extract role/title keywords
- locations: extract city, state, or region names (keep original casing)
- companies: extract company names
- keywords: extract skills, certifications, or general keywords
- experience_years: extract if mentioned (e.g. "5+ years" → 5), null otherwise
- specialties: extract medical specialties

Rules for SQL (PDL format):
- Always include job_title_role='health' for healthcare
- Use LIKE with % for partial matches on job titles
- Use location_region for states, location_locality for cities
- Use single quotes for string values
- Output valid PDL SQL

Return ONLY valid JSON, nothing else.`;

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: naturalLanguage },
      ],
      temperature: 0.1,
      max_tokens: 500,
    }),
  });

  if (!res.ok) {
    throw new Error(`AI gateway error: ${res.status}`);
  }

  const data = await res.json();
  let content = data.choices?.[0]?.message?.content?.trim() || "";
  content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  
  try {
    return JSON.parse(content);
  } catch {
    // Fallback: return empty filters and try to use content as SQL
    return {
      filters: { job_titles: [], locations: [], companies: [], keywords: [], experience_years: null, specialties: [] },
      sql: content,
    };
  }
}

function filtersToSQL(filters: ParsedFilters): string {
  const conditions: string[] = ["job_title_role='health'"];

  if (filters.job_titles.length > 0) {
    const titleConditions = filters.job_titles.map(t => `job_title LIKE '%${t.toLowerCase()}%'`);
    conditions.push(`(${titleConditions.join(" OR ")})`);
  }

  if (filters.locations.length > 0) {
    const locConditions = filters.locations.map(l => 
      `(location_region='${l.toLowerCase()}' OR location_locality='${l.toLowerCase()}')`
    );
    conditions.push(`(${locConditions.join(" OR ")})`);
  }

  if (filters.companies.length > 0) {
    const compConditions = filters.companies.map(c => `job_company_name LIKE '%${c.toLowerCase()}%'`);
    conditions.push(`(${compConditions.join(" OR ")})`);
  }

  if (filters.keywords.length > 0) {
    const kwConditions = filters.keywords.map(k => `skills='${k.toLowerCase()}'`);
    conditions.push(`(${kwConditions.join(" OR ")})`);
  }

  if (filters.specialties.length > 0) {
    const specConditions = filters.specialties.map(s => `skills='${s.toLowerCase()}'`);
    conditions.push(`(${specConditions.join(" OR ")})`);
  }

  return `SELECT * FROM person WHERE ${conditions.join(" AND ")}`;
}

async function searchPDL(sql: string, size: number) {
  const res = await fetch(`${PDL_BASE}/person/search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-api-key": PDL_API_KEY,
    },
    body: JSON.stringify({ sql, size, pretty: true, dataset: "all" }),
  });

  if (!res.ok) {
    const errText = await res.text();
    if (res.status === 404) {
      return { data: [], total: 0 };
    }
    throw new Error(`PDL Search error (${res.status}): ${errText}`);
  }
  return await res.json();
}

async function enrichPerson(params: { linkedin_url?: string; email?: string }) {
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
  return await res.json();
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

function transformSearchResults(pdlData: any) {
  if (!pdlData?.data) return [];

  return pdlData.data.map((person: any) => {
    let avgTenureMonths: number | null = null;
    if (person.experience && person.experience.length > 0) {
      const tenures = person.experience
        .filter((exp: any) => exp.start_date)
        .map((exp: any) => {
          const start = new Date(exp.start_date);
          const end = exp.end_date ? new Date(exp.end_date) : new Date();
          return (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30);
        })
        .filter((t: number) => t > 0 && t < 600);

      if (tenures.length > 0) {
        avgTenureMonths = Math.round(
          tenures.reduce((a: number, b: number) => a + b, 0) / tenures.length
        );
      }
    }

    return {
      id: person.id,
      full_name: person.full_name || "Unknown",
      title: person.job_title || null,
      current_employer: person.job_company_name || null,
      location: [person.location_locality, person.location_region]
        .filter(Boolean)
        .join(", ") || null,
      linkedin_url: person.linkedin_url || null,
      email: person.work_email || person.personal_emails?.[0] || null,
      phone: person.mobile_phone || person.phone_numbers?.[0] || null,
      skills: person.skills?.slice(0, 10) || [],
      avg_tenure_months: avgTenureMonths,
      industry: person.industry || null,
      company_size: person.job_company_size || null,
    };
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: SearchRequest = await req.json();
    const action = body.action || "search";

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

    if (action === "parse_filters") {
      const { query } = body;
      if (!query || query.trim().length === 0) {
        return new Response(
          JSON.stringify({ error: "Search query is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { filters, sql } = await parseQueryToFilters(query);
      console.log("Parsed filters:", JSON.stringify(filters));
      console.log("Generated SQL:", sql);

      // Do a quick count/search to get total matches
      const pdlResults = await searchPDL(sql, 1);

      return new Response(
        JSON.stringify({ filters, total: pdlResults.total || 0, sql_used: sql }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "search_with_filters") {
      const { filters, size = 25 } = body;
      if (!filters) {
        return new Response(
          JSON.stringify({ error: "Filters are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const sql = filtersToSQL(filters);
      console.log("Filters SQL:", sql);

      const pdlResults = await searchPDL(sql, size);
      console.log("PDL returned", pdlResults.total, "total results");

      const candidates = transformSearchResults(pdlResults);

      return new Response(
        JSON.stringify({ candidates, total: pdlResults.total || 0, sql_used: sql }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Default: legacy search (translate + search in one step)
    const { query, size = 25 } = body;
    if (!query || query.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "Search query is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { filters, sql } = await parseQueryToFilters(query);
    console.log("Generated SQL:", sql);

    const pdlResults = await searchPDL(sql, size);
    console.log("PDL returned", pdlResults.total, "total results");

    const candidates = transformSearchResults(pdlResults);

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
