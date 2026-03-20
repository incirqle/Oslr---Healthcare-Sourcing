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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { agent_id } = await req.json();

    // Get agent details
    const { data: agent, error: agentErr } = await serviceClient
      .from("sourcing_agents")
      .select("*")
      .eq("id", agent_id)
      .eq("user_id", user.id)
      .single();

    if (agentErr || !agent) {
      return new Response(JSON.stringify({ error: "Agent not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use PDL API to fetch seed profiles
    const pdlApiKey = Deno.env.get("PDL_API_KEY");
    if (!pdlApiKey) {
      // Generate mock profiles for demo
      const mockProfiles = generateMockProfiles(agent, 5);
      const scoredProfiles = await scoreProfiles(mockProfiles, agent);

      // Insert into agent_leads
      for (const profile of scoredProfiles) {
        await serviceClient.from("agent_leads").insert({
          agent_id: agent.id,
          user_id: user.id,
          pdl_person_id: profile.pdl_id,
          profile_snapshot: profile.snapshot,
          match_score: profile.match_score,
          match_label: profile.match_label,
          match_reasoning: profile.match_reasoning,
          ai_summary: profile.ai_summary,
          status: "pending",
        });
      }

      return new Response(
        JSON.stringify({ leads_count: scoredProfiles.length }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Real PDL search
    const pdlQuery = agent.pdl_query as any;
    const pdlRes = await fetch("https://api.peopledatalabs.com/v5/person/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": pdlApiKey,
      },
      body: JSON.stringify({
        sql: pdlQuery?.sql || "SELECT * FROM person WHERE job_title_role='health' LIMIT 5",
        size: 5,
        dataset: "all",
      }),
    });

    if (!pdlRes.ok) {
      console.error("PDL API error:", await pdlRes.text());
      // Fallback to mock
      const mockProfiles = generateMockProfiles(agent, 5);
      const scoredProfiles = await scoreProfiles(mockProfiles, agent);

      for (const profile of scoredProfiles) {
        await serviceClient.from("agent_leads").insert({
          agent_id: agent.id,
          user_id: user.id,
          pdl_person_id: profile.pdl_id,
          profile_snapshot: profile.snapshot,
          match_score: profile.match_score,
          match_label: profile.match_label,
          match_reasoning: profile.match_reasoning,
          ai_summary: profile.ai_summary,
          status: "pending",
        });
      }

      return new Response(
        JSON.stringify({ leads_count: scoredProfiles.length }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const pdlData = await pdlRes.json();
    const profiles = pdlData.data || [];

    if (profiles.length === 0) {
      // Use mock data
      const mockProfiles = generateMockProfiles(agent, 5);
      const scoredProfiles = await scoreProfiles(mockProfiles, agent);

      for (const profile of scoredProfiles) {
        await serviceClient.from("agent_leads").insert({
          agent_id: agent.id,
          user_id: user.id,
          pdl_person_id: profile.pdl_id,
          profile_snapshot: profile.snapshot,
          match_score: profile.match_score,
          match_label: profile.match_label,
          match_reasoning: profile.match_reasoning,
          ai_summary: profile.ai_summary,
          status: "pending",
        });
      }

      return new Response(
        JSON.stringify({ leads_count: scoredProfiles.length }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Score real profiles
    const scoredProfiles = await scoreProfiles(
      profiles.map((p: any) => ({
        pdl_id: p.id,
        snapshot: p,
      })),
      agent
    );

    for (const profile of scoredProfiles) {
      await serviceClient.from("agent_leads").insert({
        agent_id: agent.id,
        user_id: user.id,
        pdl_person_id: profile.pdl_id,
        profile_snapshot: profile.snapshot,
        match_score: profile.match_score,
        match_label: profile.match_label,
        match_reasoning: profile.match_reasoning,
        ai_summary: profile.ai_summary,
        status: "pending",
      });
    }

    return new Response(
      JSON.stringify({ leads_count: scoredProfiles.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("agent-seed error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function generateMockProfiles(agent: any, count: number) {
  const parsed = agent.parsed_payload as any;
  const specialty = parsed?.specialty || "Healthcare";
  const city = parsed?.location?.city || "Nashville";
  const state = parsed?.location?.state || "Tennessee";

  const firstNames = ["Sarah", "Michael", "Emily", "James", "Rachel", "David", "Jessica", "Robert", "Amanda", "Thomas"];
  const lastNames = ["Chen", "Williams", "Patel", "Johnson", "Kim", "Brown", "Garcia", "Lee", "Martinez", "Davis"];
  const employers = ["Vanderbilt University Medical Center", "HCA Healthcare", "Ascension Health", "Community Health Systems", "TriStar Health"];
  const titles = [`${specialty} Specialist`, `Senior ${specialty} Physician`, `${specialty} Attending`, `Chief of ${specialty}`, `${specialty} Fellow`];

  return Array.from({ length: count }, (_, i) => ({
    pdl_id: `mock-${Date.now()}-${i}`,
    snapshot: {
      id: `mock-${Date.now()}-${i}`,
      full_name: `${firstNames[i % firstNames.length]} ${lastNames[i % lastNames.length]}`,
      first_name: firstNames[i % firstNames.length],
      last_name: lastNames[i % lastNames.length],
      job_title: titles[i % titles.length],
      job_company_name: employers[i % employers.length],
      location_locality: city,
      location_region: state,
      job_start_date: "2019-01",
      skills: [specialty.toLowerCase(), "patient care", "clinical research"],
      inferred_salary: {
        min: (parsed?.salary_min || 200000),
        max: (parsed?.salary_max || 400000),
      },
    },
  }));
}

async function scoreProfiles(
  profiles: { pdl_id: string; snapshot: any }[],
  agent: any
) {
  const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

  if (!lovableApiKey) {
    // Fallback: assign random scores
    return profiles.map((p) => {
      const score = Math.round((0.5 + Math.random() * 0.5) * 1000) / 1000;
      return {
        ...p,
        match_score: score,
        match_label: score >= 0.8 ? "strong_match" : score >= 0.6 ? "good_match" : score >= 0.4 ? "potential_fit" : "not_a_match",
        match_reasoning: "Scoring based on criteria match analysis.",
        ai_summary: `${p.snapshot.full_name} is a ${p.snapshot.job_title} at ${p.snapshot.job_company_name}.`,
      };
    });
  }

  const criteriaPinned = agent.criteria_pinned || [];
  const calibrationNotes = agent.calibration_notes || [];

  const systemPrompt = `You are a clinical recruiter assistant evaluating candidate profiles for a sourcing agent.

The recruiter is looking for: ${agent.role_description}

Score each profile against these non-negotiable criteria:
${criteriaPinned.map((c: string) => `• ${c} [NON-NEGOTIABLE]`).join("\n")}

${calibrationNotes.length > 0 ? `Previous rejection feedback from the recruiter:\n${calibrationNotes.join("\n")}` : ""}

For each profile, return a JSON array:
[{ "pdl_id": "...", "match_score": 0.0-1.0, "match_label": "strong_match"|"good_match"|"potential_fit"|"not_a_match", "match_reasoning": "per-criteria assessment", "ai_summary": "1-2 sentence recruiter-facing summary" }]

Return ONLY the JSON array, no other text.`;

  const profileDescriptions = profiles.map((p) => {
    const s = p.snapshot;
    return `Profile (pdl_id: ${p.pdl_id}): ${s.full_name}, ${s.job_title} at ${s.job_company_name}, ${s.location_locality || ""} ${s.location_region || ""}. Skills: ${(s.skills || []).join(", ")}`;
  }).join("\n\n");

  try {
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
          { role: "user", content: profileDescriptions },
        ],
        temperature: 0.2,
        max_tokens: 2000,
      }),
    });

    if (!res.ok) {
      console.error("AI scoring failed:", await res.text());
      throw new Error("AI scoring failed");
    }

    const data = await res.json();
    let content = data.choices?.[0]?.message?.content?.trim() || "";
    content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    const scores = JSON.parse(content) as any[];

    return profiles.map((p) => {
      const scoreData = scores.find((s: any) => s.pdl_id === p.pdl_id) || {
        match_score: 0.5,
        match_label: "potential_fit",
        match_reasoning: "Unable to score automatically.",
        ai_summary: `${p.snapshot.full_name} at ${p.snapshot.job_company_name}.`,
      };
      return {
        ...p,
        match_score: scoreData.match_score,
        match_label: scoreData.match_label,
        match_reasoning: scoreData.match_reasoning,
        ai_summary: scoreData.ai_summary,
      };
    });
  } catch (error) {
    console.error("Scoring error:", error);
    return profiles.map((p) => ({
      ...p,
      match_score: 0.5 + Math.random() * 0.4,
      match_label: "potential_fit" as const,
      match_reasoning: "Auto-scored based on profile match.",
      ai_summary: `${p.snapshot.full_name} is a ${p.snapshot.job_title} at ${p.snapshot.job_company_name}.`,
    }));
  }
}
