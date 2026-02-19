import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PDL_API_KEY = Deno.env.get("PDL_API_KEY")!;
const PDL_PREVIEW_API_KEY = Deno.env.get("PDL_PREVIEW_API_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const PDL_BASE = "https://api.peopledatalabs.com/v5";

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

interface ParsedFilters {
  job_titles: string[];
  locations: string[];
  companies: string[];
  keywords: string[];
  experience_years?: number | null;
  specialties: string[];
}

// ─── Healthcare role — always clinical ───────────────────────────────────────
function inferRoles(_filters: ParsedFilters): string[] {
  return ["health"];
}

// ─── Build PDL SQL from structured filters ────────────────────────────────────
function filtersToSQL(filters: ParsedFilters): string {
  const conditions: string[] = [];

  const roles = inferRoles(filters);
  if (roles.length === 1) {
    conditions.push(`job_title_role='${roles[0]}'`);
  } else {
    conditions.push(`(${roles.map((r) => `job_title_role='${r}'`).join(" OR ")})`);
  }

  const titleTerms = [
    ...filters.job_titles,
    ...filters.specialties,
  ];
  if (titleTerms.length > 0) {
    const titleConditions = titleTerms.map(
      (t) => `job_title LIKE '%${t.toLowerCase()}%'`
    );
    conditions.push(`(${titleConditions.join(" OR ")})`);
  }

  if (filters.locations.length > 0) {
    const locConditions = filters.locations.map((l) => {
      const lc = l.toLowerCase().trim();
      const stateMap: Record<string, string> = {
        "alabama": "alabama", "alaska": "alaska", "arizona": "arizona", "arkansas": "arkansas",
        "california": "california", "colorado": "colorado", "connecticut": "connecticut",
        "delaware": "delaware", "florida": "florida", "georgia": "georgia", "hawaii": "hawaii",
        "idaho": "idaho", "illinois": "illinois", "indiana": "indiana", "iowa": "iowa",
        "kansas": "kansas", "kentucky": "kentucky", "louisiana": "louisiana", "maine": "maine",
        "maryland": "maryland", "massachusetts": "massachusetts", "michigan": "michigan",
        "minnesota": "minnesota", "mississippi": "mississippi", "missouri": "missouri",
        "montana": "montana", "nebraska": "nebraska", "nevada": "nevada",
        "new hampshire": "new hampshire", "new jersey": "new jersey", "new mexico": "new mexico",
        "new york": "new york", "north carolina": "north carolina", "north dakota": "north dakota",
        "ohio": "ohio", "oklahoma": "oklahoma", "oregon": "oregon", "pennsylvania": "pennsylvania",
        "rhode island": "rhode island", "south carolina": "south carolina", "south dakota": "south dakota",
        "tennessee": "tennessee", "texas": "texas", "utah": "utah", "vermont": "vermont",
        "virginia": "virginia", "washington": "washington", "west virginia": "west virginia",
        "wisconsin": "wisconsin", "wyoming": "wyoming",
      };
      if (stateMap[lc]) {
        return `location_region='${lc}'`;
      }
      for (const state of Object.keys(stateMap)) {
        if (lc.endsWith(` ${state}`)) {
          const city = lc.slice(0, lc.length - state.length - 1).trim();
          return `(location_locality='${city}' AND location_region='${state}')`;
        }
      }
      return `(location_region='${lc}' OR location_locality='${lc}')`;
    });
    conditions.push(`(${locConditions.join(" OR ")})`);
  }

  if (filters.companies.length > 0) {
    const compConditions = filters.companies.map(
      (c) => `job_company_name LIKE '%${c.toLowerCase()}%'`
    );
    conditions.push(`(${compConditions.join(" OR ")})`);
  }

  if (filters.keywords.length > 0) {
    const kwConditions = filters.keywords.map(
      (k) => `skills LIKE '%${k.toLowerCase()}%'`
    );
    conditions.push(`(${kwConditions.join(" OR ")})`);
  }

  // Safety: if only the role filter exists (no titles, locations, companies, or keywords),
  // the query is too broad and will return millions of results
  if (conditions.length <= 1) {
    throw new Error("Filters are too broad — at least a job title, location, or company is required to run a search.");
  }

  return `SELECT * FROM person WHERE ${conditions.join(" AND ")}`;
}

// ─── AI query parser ──────────────────────────────────────────────────────────
async function parseQueryToFilters(naturalLanguage: string): Promise<ParsedFilters> {
  const systemPrompt = `You are a search query parser for a clinical healthcare recruiting platform that finds doctors, nurses, and allied health professionals.

Return ONLY valid JSON with this exact structure — no explanation, no markdown:
{
  "job_titles": ["registered nurse", "RN"],
  "locations": ["Texas"],
  "companies": [],
  "keywords": [],
  "experience_years": null,
  "specialties": []
}

Rules:
- This platform is ONLY for clinical healthcare roles: physicians, surgeons, nurses, NPs, PAs, CRNAs, therapists, technicians, pharmacists, etc.
- IGNORE any sales, device rep, pharma rep, or commercial roles — those are not supported.
- job_titles: Extract clinical role/title keywords. Expand abbreviations: "ER doctor" → ["emergency medicine physician", "emergency physician"]; "ICU nurse" → ["ICU nurse", "intensive care unit nurse", "critical care nurse", "registered nurse"]; "CRNA" → ["CRNA", "certified registered nurse anesthetist"].
- locations: ALWAYS separate city and state into a SINGLE string like "Miami Florida" (city first, then state). If only a state is given, use just the state name (e.g., "Texas"). If only a city, use just the city (e.g., "Dallas"). Examples: "doctors in Miami, FL" → ["Miami Florida"]; "nurses in Texas" → ["Texas"]; "surgeons in Dallas, Texas" → ["Dallas Texas"].
- companies: Specific hospital or health system names only (e.g., "HCA Healthcare", "Mayo Clinic").
- keywords: Clinical skills, certifications, tools (e.g., "ACLS", "BLS", "Epic", "laparoscopic", "ventilator management").
- experience_years: Number only if explicitly stated (e.g., "5+ years" → 5), null otherwise.
- specialties: Medical specialties not already captured in job_titles (e.g., "cardiology", "orthopedics", "oncology").

IMPORTANT: Do NOT include "health" or PDL role names. Just extract what the user said.`;

  const models = ["google/gemini-3-flash-preview", "openai/gpt-5-mini"];
  let lastError: Error | null = null;

  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      if (attempt > 0) await new Promise(r => setTimeout(r, 1000));
      try {
        const isOpenAI = model.startsWith("openai/");
        const bodyObj: any = {
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: naturalLanguage },
          ],
        };
        if (isOpenAI) {
          bodyObj.max_completion_tokens = 400;
        } else {
          bodyObj.temperature = 0.1;
          bodyObj.max_tokens = 400;
        }
        const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
          },
          body: JSON.stringify(bodyObj),
        });

        if (res.ok) {
          const data = await res.json();
          let content = data.choices?.[0]?.message?.content?.trim() || "";
          content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

          try {
            const parsed = JSON.parse(content);
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
            throw new Error("Failed to understand your search query. Please try rephrasing it.");
          }
        }

        const errBody = await res.text();
        console.error(`AI gateway ${model} attempt ${attempt + 1} failed: ${res.status} - ${errBody}`);
        lastError = new Error(`AI gateway error: ${res.status}`);
      } catch (e) {
        console.error(`AI gateway ${model} attempt ${attempt + 1} exception:`, e);
        lastError = e instanceof Error ? e : new Error(String(e));
      }
    }
  }

  throw lastError!;

}

async function searchPDL(sql: string, size: number, from: number = 0) {
  console.log("PDL SQL:", sql, "size:", size, "from:", from);
  const body: any = { sql, size, pretty: true, dataset: "all" };
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

// ─── Transform: handles both full and preview API responses ───────────────────
function transformSearchResults(pdlData: any) {
  if (!pdlData?.data) return [];

  return pdlData.data.map((person: any) => {
    // Detect preview mode: if skills/experience are booleans instead of arrays
    const isPreview =
      typeof person.skills === "boolean" ||
      typeof person.experience === "boolean" ||
      typeof person.work_email === "boolean";

    // Skills
    let skills: string[] = [];
    let has_skills = false;
    if (typeof person.skills === "boolean") {
      has_skills = person.skills;
    } else if (Array.isArray(person.skills)) {
      skills = person.skills.slice(0, 10);
      has_skills = skills.length > 0;
    }

    // Email
    let email: string | null = null;
    let has_email = false;
    if (typeof person.work_email === "boolean") {
      has_email = person.work_email;
    } else if (typeof person.personal_emails === "boolean") {
      has_email = person.personal_emails;
    } else {
      email = person.work_email || person.personal_emails?.[0] || null;
      has_email = !!email;
    }

    // Phone
    let phone: string | null = null;
    let has_phone = false;
    if (typeof person.mobile_phone === "boolean") {
      has_phone = person.mobile_phone;
    } else if (typeof person.phone_numbers === "boolean") {
      has_phone = person.phone_numbers;
    } else {
      phone = person.mobile_phone || person.phone_numbers?.[0] || null;
      has_phone = !!phone;
    }

    // Tenure — only computable with real experience data
    let avgTenureMonths: number | null = null;
    let has_experience = false;
    if (typeof person.experience === "boolean") {
      has_experience = person.experience;
    } else if (Array.isArray(person.experience) && person.experience.length > 0) {
      has_experience = true;
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

    // Location — in preview mode, person location fields are booleans,
    // but job_company_location fields have real data
    let location: string | null = null;
    const locCity = typeof person.location_locality === "string" ? person.location_locality : null;
    const locRegion = typeof person.location_region === "string" ? person.location_region : null;
    if (locCity || locRegion) {
      location = [locCity, locRegion].filter(Boolean).join(", ");
    } else {
      // Fallback to company location (available in preview)
      const compCity = typeof person.job_company_location_locality === "string" ? person.job_company_location_locality : null;
      const compRegion = typeof person.job_company_location_region === "string" ? person.job_company_location_region : null;
      if (compCity || compRegion) {
        location = [compCity, compRegion].filter(Boolean).join(", ");
      }
    }

    // Clean credential prefixes from full_name (e.g. "faaos john doe" → "john doe")
    let fullName = person.full_name || "Unknown";
    const credentialPrefixes = /^(faaos|caqsm|facp|facs|facep|faap|facog|md|do|rn|bsn|msn|dnp|phd|mph|dpm|dds|dmd|aprn|np|pa-c|pt|ot|slp|rd|ldn|pharmd)\s+/i;
    fullName = fullName.replace(credentialPrefixes, "").trim();
    // Capitalize properly
    fullName = fullName.replace(/\b\w/g, (c: string) => c.toUpperCase());

    return {
      id: person.id,
      full_name: fullName,
      title: person.job_title || null,
      current_employer: person.job_company_name || null,
      location,
      linkedin_url: person.linkedin_url || null,
      email,
      phone,
      skills,
      avg_tenure_months: avgTenureMonths,
      industry: person.industry || null,
      company_size: typeof person.job_company_size === "boolean" ? null : (person.job_company_size || null),
      // Preview indicators
      preview: isPreview,
      has_email,
      has_phone,
      has_skills,
      has_experience,
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
      const { filters, size = 15, from = 0 } = body;
      if (!filters) {
        return new Response(
          JSON.stringify({ error: "Filters are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const sql = filtersToSQL(filters);
      console.log("Search SQL:", sql);

      const pdlResults = await searchPDL(sql, size, from);
      console.log("PDL returned", pdlResults.total, "total results");

      const candidates = transformSearchResults(pdlResults);

      return new Response(
        JSON.stringify({ candidates, total: pdlResults.total || 0, sql_used: sql }),
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
