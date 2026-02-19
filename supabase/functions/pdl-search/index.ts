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

// ─── Healthcare role categories in PDL ───────────────────────────────────────
// PDL's job_title_role field covers only clinical staff.
// Medical device / pharma sales reps sit in 'sales' role, NOT 'health'.
// We detect whether a search is clinical or commercial and pick the right roles.
function inferRoles(filters: ParsedFilters): string[] {
  const allTerms = [
    ...filters.job_titles,
    ...filters.specialties,
    ...filters.keywords,
  ].map((t) => t.toLowerCase());

  const salesKeywords = [
    "rep", "representative", "sales", "device", "pharma", "account",
    "territory", "manager", "distributor", "bd", "business development",
  ];
  const isSalesRole = allTerms.some((t) =>
    salesKeywords.some((kw) => t.includes(kw))
  );

  // If clearly sales-oriented, allow both health and sales roles
  if (isSalesRole) return ["health", "sales"];
  return ["health"];
}

// ─── Build PDL SQL from structured filters ────────────────────────────────────
// Key fixes vs. original:
//  1. job_title_role is now dynamic (sales roles included when relevant)
//  2. specialties merge into job_title LIKE clauses (no 'specialty' column in PDL)
//  3. keywords use LIKE '%x%' instead of exact skills='x' match
//  4. location values are always lowercased
function filtersToSQL(filters: ParsedFilters): string {
  const conditions: string[] = [];

  // 1. Role filter — dynamic based on what's being searched
  const roles = inferRoles(filters);
  if (roles.length === 1) {
    conditions.push(`job_title_role='${roles[0]}'`);
  } else {
    conditions.push(`(${roles.map((r) => `job_title_role='${r}'`).join(" OR ")})`);
  }

  // 2. Job titles + specialties both map to job_title LIKE clauses
  const titleTerms = [
    ...filters.job_titles,
    ...filters.specialties, // specialties become title keywords — PDL has no specialty column
  ];
  if (titleTerms.length > 0) {
    const titleConditions = titleTerms.map(
      (t) => `job_title LIKE '%${t.toLowerCase()}%'`
    );
    conditions.push(`(${titleConditions.join(" OR ")})`);
  }

  // 3. Location — support state and city, always lowercase
  if (filters.locations.length > 0) {
    const locConditions = filters.locations.map((l) => {
      const lc = l.toLowerCase();
      return `(location_region='${lc}' OR location_locality='${lc}')`;
    });
    conditions.push(`(${locConditions.join(" OR ")})`);
  }

  // 4. Company filter
  if (filters.companies.length > 0) {
    const compConditions = filters.companies.map(
      (c) => `job_company_name LIKE '%${c.toLowerCase()}%'`
    );
    conditions.push(`(${compConditions.join(" OR ")})`);
  }

  // 5. Keywords — partial match on skills (was exact match — broken)
  if (filters.keywords.length > 0) {
    const kwConditions = filters.keywords.map(
      (k) => `skills LIKE '%${k.toLowerCase()}%'`
    );
    conditions.push(`(${kwConditions.join(" OR ")})`);
  }

  return `SELECT * FROM person WHERE ${conditions.join(" AND ")}`;
}

// ─── AI query parser ──────────────────────────────────────────────────────────
async function parseQueryToFilters(naturalLanguage: string): Promise<ParsedFilters> {
  const systemPrompt = `You are a search query parser for a healthcare recruiting platform. Extract structured filters from the natural language query.

Return ONLY valid JSON with this exact structure — no explanation, no markdown:
{
  "job_titles": ["spine rep", "spine sales representative"],
  "locations": ["Texas"],
  "companies": [],
  "keywords": [],
  "experience_years": null,
  "specialties": []
}

Rules:
- job_titles: Extract role/title keywords. For healthcare sales roles like "spine reps", "ortho reps", "device reps" — include variations like "spine rep", "spine sales representative", "spine sales rep". For clinical roles like "ICU nurse", include "registered nurse", "RN".
- locations: State or city names exactly as written (e.g., "Texas", "Dallas").
- companies: Specific employer names only.
- keywords: Skills, certifications, tools (e.g., "ACLS", "Epic", "laparoscopic").
- experience_years: Number only if explicitly stated (e.g., "5+ years" → 5), null otherwise.
- specialties: Medical specialties ONLY if not already captured in job_titles (e.g., "cardiology", "orthopedics"). Leave empty for sales roles — specialty is already in the title.

IMPORTANT: Do NOT include "health" or PDL role names. Just extract what the user said.`;

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
      max_tokens: 400,
    }),
  });

  if (!res.ok) throw new Error(`AI gateway error: ${res.status}`);

  const data = await res.json();
  let content = data.choices?.[0]?.message?.content?.trim() || "";
  content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

  try {
    const parsed = JSON.parse(content);
    // Normalise — ensure all arrays exist
    return {
      job_titles: parsed.job_titles ?? [],
      locations: parsed.locations ?? [],
      companies: parsed.companies ?? [],
      keywords: parsed.keywords ?? [],
      experience_years: parsed.experience_years ?? null,
      specialties: parsed.specialties ?? [],
    };
  } catch {
    console.error("Failed to parse AI response:", content);
    return {
      job_titles: [],
      locations: [],
      companies: [],
      keywords: [],
      experience_years: null,
      specialties: [],
    };
  }
}

async function searchPDL(sql: string, size: number) {
  console.log("PDL SQL:", sql);
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
    if (res.status === 404) return { data: [], total: 0 };
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

      const filters = await parseQueryToFilters(query);
      console.log("Parsed filters:", JSON.stringify(filters));

      // Use our own filtersToSQL (not AI-generated) for a consistent count
      const sql = filtersToSQL(filters);
      console.log("Count SQL:", sql);

      const pdlResults = await searchPDL(sql, 1);
      console.log("Filter count:", pdlResults.total);

      return new Response(
        JSON.stringify({ filters, total: pdlResults.total || 0, sql_used: sql }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Search with filters (step 2 of 2-step search) ─────────────────────────
    if (action === "search_with_filters") {
      const { filters, size = 25 } = body;
      if (!filters) {
        return new Response(
          JSON.stringify({ error: "Filters are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const sql = filtersToSQL(filters);
      console.log("Search SQL:", sql);

      const pdlResults = await searchPDL(sql, size);
      console.log("PDL returned", pdlResults.total, "total results");

      const candidates = transformSearchResults(pdlResults);

      return new Response(
        JSON.stringify({ candidates, total: pdlResults.total || 0, sql_used: sql }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Legacy single-step search ─────────────────────────────────────────────
    const { query, size = 25 } = body;
    if (!query || query.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "Search query is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const filters = await parseQueryToFilters(query);
    const sql = filtersToSQL(filters);
    console.log("Legacy SQL:", sql);

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
