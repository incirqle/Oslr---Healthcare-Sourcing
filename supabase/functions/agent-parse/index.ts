import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { role_description } = await req.json();
    if (!role_description || typeof role_description !== "string") {
      return new Response(JSON.stringify({ error: "role_description required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) {
      return new Response(JSON.stringify({ error: "AI API key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Call AI to parse the role description
    const systemPrompt = `You are a clinical healthcare recruiting assistant. Parse the following role description into structured fields.

Return ONLY valid JSON with this exact structure:
{
  "clinical_role": "physician" | "np" | "pa" | "crna" | "rn" | "allied_health" | "admin" | "general",
  "specialty": string | null,
  "practice_setting": "hospital" | "ambulatory" | "outpatient" | "private_practice" | "telehealth" | null,
  "employer": string | null,
  "location": { "city": string | null, "metro": string | null, "state": string | null },
  "salary_min": number | null,
  "salary_max": number | null,
  "tenure_min_years": number | null,
  "active_status": "current" | "past" | "any"
}

Rules:
- clinical_role: Map to the closest category. "cardiologist" → "physician", "nurse practitioner" → "np", etc.
- specialty: The medical specialty mentioned (cardiology, orthopedics, etc.)
- location: Extract city and state. Use full state names lowercase.
- salary_min/max: Extract dollar amounts. "$350k+" → salary_min: 350000
- tenure_min_years: Extract years of experience. "5+ years" → 5
- active_status: Default to "current" unless explicitly stated otherwise.`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableApiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: role_description },
        ],
        temperature: 0.1,
        max_tokens: 500,
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error("AI gateway failed:", res.status, errBody);
      throw new Error(`AI parse failed: ${res.status}`);
    }

    const data = await res.json();
    let content = data.choices?.[0]?.message?.content?.trim() || "";
    content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    const parsed = JSON.parse(content);

    // Build PDL query from parsed payload
    const pdlQuery = buildPdlQueryFromParsed(parsed);

    return new Response(
      JSON.stringify({ parsed_payload: parsed, pdl_query: pdlQuery }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("agent-parse error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function buildPdlQueryFromParsed(parsed: any) {
  const conditions: string[] = [];
  conditions.push("job_title_role='health'");

  // Clinical role signals
  const roleSignals: Record<string, string[]> = {
    physician: ["physician", "doctor", "MD", "DO", "surgeon"],
    np: ["nurse practitioner", "NP", "APRN"],
    pa: ["physician assistant", "PA", "PA-C"],
    crna: ["certified registered nurse anesthetist", "CRNA"],
    rn: ["registered nurse", "RN", "nurse"],
    allied_health: ["therapist", "technologist", "technician"],
  };

  const roleTerms = roleSignals[parsed.clinical_role] || [];
  if (parsed.specialty) {
    roleTerms.push(parsed.specialty.toLowerCase());
  }

  if (roleTerms.length > 0) {
    const titleConds = roleTerms.map((t: string) => `job_title LIKE '%${t}%'`);
    conditions.push(`(${titleConds.join(" OR ")})`);
  }

  if (parsed.location?.state) {
    conditions.push(`location_region='${parsed.location.state.toLowerCase()}'`);
  }
  if (parsed.location?.city) {
    conditions.push(`location_locality='${parsed.location.city.toLowerCase()}'`);
  }

  if (parsed.employer) {
    conditions.push(`job_company_name LIKE '%${parsed.employer}%'`);
  }

  const sql = `SELECT * FROM person WHERE ${conditions.join(" AND ")}`;
  return { sql, size: 100 };
}
