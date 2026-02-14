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
  action?: "search" | "enrich_person" | "enrich_company";
  query?: string;
  size?: number;
  // For person enrichment
  linkedin_url?: string;
  email?: string;
  // For company enrichment
  company_name?: string;
  company_website?: string;
}

async function translateQueryToSQL(naturalLanguage: string): Promise<string> {
  const systemPrompt = `You are a People Data Labs SQL query translator specialized in healthcare recruiting.

Convert natural language queries into PDL SQL format: SELECT * FROM person WHERE ...

Available PDL fields for healthcare:
- job_title (text): e.g. 'registered nurse', 'cardiologist', 'nurse practitioner', 'physician assistant'
- job_title_role (enum): 'health' for healthcare roles
- job_company_name (text): employer name e.g. 'HCA Healthcare', 'Kaiser Permanente'
- location_locality (text): city
- location_region (text): state e.g. 'texas', 'california'
- location_country (text): country code e.g. 'united states'
- experience (array): contains job history with title, company, start/end dates
- skills (array): e.g. 'nursing', 'cardiology', 'icu', 'emergency medicine'
- industry (text): e.g. 'hospitals and health care', 'medical practices'
- job_company_industry (text): company's industry

Rules:
- Always include job_title_role='health' to focus on healthcare
- Use LIKE with % for partial matches on job titles
- For experience years, use job_start_date
- For location, prefer location_region for states, location_locality for cities
- Output ONLY the SQL string, nothing else
- Use single quotes for string values
- Keep it simple and valid PDL SQL

Examples:
- "Nurses in Texas" → SELECT * FROM person WHERE job_title LIKE '%nurse%' AND location_region='texas' AND job_title_role='health'
- "Cardiologists at Kaiser" → SELECT * FROM person WHERE job_title LIKE '%cardiologist%' AND job_company_name LIKE '%kaiser%' AND job_title_role='health'
- "ICU nurses in Dallas" → SELECT * FROM person WHERE job_title LIKE '%nurse%' AND skills='icu' AND location_locality='dallas' AND job_title_role='health'`;

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
      max_tokens: 300,
    }),
  });

  if (!res.ok) {
    throw new Error(`AI gateway error: ${res.status}`);
  }

  const data = await res.json();
  let sql = data.choices?.[0]?.message?.content?.trim() || "";
  sql = sql.replace(/```sql\n?/g, "").replace(/```\n?/g, "").trim();
  return sql;
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
    // PDL returns 404 when no results found — not an error
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

    // Default: search
    const { query, size = 25 } = body;
    if (!query || query.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "Search query is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const sql = await translateQueryToSQL(query);
    console.log("Generated SQL:", sql);

    const pdlResults = await searchPDL(sql, size);
    console.log("PDL returned", pdlResults.total, "total results");

    const candidates = transformSearchResults(pdlResults);

    return new Response(
      JSON.stringify({ candidates, total: pdlResults.total || 0, sql_used: sql }),
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
