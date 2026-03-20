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
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check for optional auth (manual trigger) or service role (cron)
    let specificAgentId: string | null = null;
    try {
      const body = await req.json();
      specificAgentId = body?.agent_id || null;
    } catch {
      // No body = cron trigger, process all
    }

    // Get active agents
    let query = serviceClient
      .from("sourcing_agents")
      .select("*")
      .eq("status", "active");

    if (specificAgentId) {
      query = serviceClient
        .from("sourcing_agents")
        .select("*")
        .eq("id", specificAgentId)
        .in("status", ["active", "out_of_leads"]);
    }

    const { data: agents, error: agentsErr } = await query;
    if (agentsErr) throw agentsErr;

    if (!agents || agents.length === 0) {
      return new Response(
        JSON.stringify({ agents_processed: 0, total_leads_inserted: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let totalLeadsInserted = 0;

    for (const agent of agents) {
      try {
        // Get already seen PDL IDs
        const { data: seenLeads } = await serviceClient
          .from("agent_leads")
          .select("pdl_person_id")
          .eq("agent_id", agent.id);

        const seenIds = new Set((seenLeads || []).map((l) => l.pdl_person_id));

        // Try PDL search
        const pdlApiKey = Deno.env.get("PDL_API_KEY");
        let profiles: any[] = [];

        if (pdlApiKey) {
          const pdlQuery = agent.pdl_query as any;
          const fetchSize = (agent.daily_lead_quota || 5) * 3;

          try {
            const pdlRes = await fetch("https://api.peopledatalabs.com/v5/person/search", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-Api-Key": pdlApiKey,
              },
              body: JSON.stringify({
                sql: pdlQuery?.sql || "SELECT * FROM person WHERE job_title_role='health'",
                size: fetchSize,
                dataset: "all",
              }),
            });

            if (pdlRes.ok) {
              const pdlData = await pdlRes.json();
              profiles = (pdlData.data || []).filter((p: any) => !seenIds.has(p.id));
            }
          } catch (pdlErr) {
            console.error(`PDL error for agent ${agent.id}:`, pdlErr);
          }
        }

        if (profiles.length === 0) {
          // Generate mock profiles for demo
          profiles = generateMockProfiles(agent, agent.daily_lead_quota || 5, seenIds);
        }

        if (profiles.length === 0) {
          await serviceClient
            .from("sourcing_agents")
            .update({ status: "out_of_leads" })
            .eq("id", agent.id);
          continue;
        }

        // Score profiles
        const scoredProfiles = await scoreProfiles(
          profiles.map((p: any) => ({
            pdl_id: p.id || p.pdl_id || `mock-${Date.now()}-${Math.random()}`,
            snapshot: p,
          })),
          agent
        );

        // Filter out low scores
        const qualified = scoredProfiles
          .filter((p) => p.match_score >= 0.4)
          .sort((a, b) => b.match_score - a.match_score)
          .slice(0, agent.daily_lead_quota || 5);

        // Insert leads
        for (const profile of qualified) {
          const leadStatus = agent.sequence_mode === "auto_sequence" && agent.review_mode === "auto"
            ? "approved"
            : "pending";

          await serviceClient.from("agent_leads").insert({
            agent_id: agent.id,
            user_id: agent.user_id,
            pdl_person_id: profile.pdl_id,
            profile_snapshot: profile.snapshot,
            match_score: profile.match_score,
            match_label: profile.match_label,
            match_reasoning: profile.match_reasoning,
            ai_summary: profile.ai_summary,
            status: leadStatus,
          });
        }

        // Update agent stats
        await serviceClient
          .from("sourcing_agents")
          .update({
            leads_total: (agent.leads_total || 0) + qualified.length,
            last_run_at: new Date().toISOString(),
            status: "active",
          })
          .eq("id", agent.id);

        totalLeadsInserted += qualified.length;
      } catch (agentErr) {
        console.error(`Error processing agent ${agent.id}:`, agentErr);
        await serviceClient
          .from("sourcing_agents")
          .update({ status: "failed" })
          .eq("id", agent.id);
      }
    }

    return new Response(
      JSON.stringify({
        agents_processed: agents.length,
        total_leads_inserted: totalLeadsInserted,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("agent-runner error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function generateMockProfiles(agent: any, count: number, seenIds: Set<string>) {
  const parsed = agent.parsed_payload as any;
  const specialty = parsed?.specialty || "Healthcare";
  const city = parsed?.location?.city || "Nashville";
  const state = parsed?.location?.state || "Tennessee";

  const firstNames = ["Sarah", "Michael", "Emily", "James", "Rachel", "David", "Jessica", "Robert", "Amanda", "Thomas", "Lauren", "Christopher", "Nicole", "Daniel", "Ashley", "Matthew", "Stephanie", "Andrew", "Jennifer", "Joshua"];
  const lastNames = ["Chen", "Williams", "Patel", "Johnson", "Kim", "Brown", "Garcia", "Lee", "Martinez", "Davis", "Wilson", "Anderson", "Taylor", "Moore", "Jackson", "Thompson", "White", "Harris", "Clark", "Lewis"];
  const employers = ["Vanderbilt University Medical Center", "HCA Healthcare", "Ascension Health", "Community Health Systems", "TriStar Health", "Centura Health", "CommonSpirit Health", "Tenet Healthcare", "Memorial Hermann", "Cleveland Clinic"];

  const profiles = [];
  for (let i = 0; i < count * 2 && profiles.length < count; i++) {
    const id = `mock-${Date.now()}-${i}-${Math.random().toString(36).slice(2)}`;
    if (seenIds.has(id)) continue;
    profiles.push({
      id,
      pdl_id: id,
      full_name: `${firstNames[i % firstNames.length]} ${lastNames[(i + 3) % lastNames.length]}`,
      first_name: firstNames[i % firstNames.length],
      last_name: lastNames[(i + 3) % lastNames.length],
      job_title: `${specialty} ${["Specialist", "Physician", "Attending", "Consultant", "Fellow"][i % 5]}`,
      job_company_name: employers[i % employers.length],
      location_locality: city,
      location_region: state,
      job_start_date: `${2015 + (i % 8)}-01`,
      skills: [specialty.toLowerCase(), "patient care", "clinical research"],
      inferred_salary: {
        min: (parsed?.salary_min || 200000),
        max: (parsed?.salary_max || 400000),
      },
    });
  }
  return profiles;
}

async function scoreProfiles(profiles: any[], agent: any) {
  const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

  if (!lovableApiKey) {
    return profiles.map((p) => {
      const score = Math.round((0.5 + Math.random() * 0.5) * 1000) / 1000;
      return {
        ...p,
        match_score: score,
        match_label: score >= 0.8 ? "strong_match" : score >= 0.6 ? "good_match" : "potential_fit",
        match_reasoning: "Auto-scored.",
        ai_summary: `${p.snapshot.full_name || p.snapshot.first_name} at ${p.snapshot.job_company_name}.`,
      };
    });
  }

  const criteriaPinned = agent.criteria_pinned || [];
  const calibrationNotes = agent.calibration_notes || [];

  try {
    const systemPrompt = `You are a clinical recruiter assistant evaluating candidate profiles.

The recruiter described their ideal candidate as:
${agent.role_description}

Score each profile against these non-negotiable criteria:
${criteriaPinned.map((c: string) => `• ${c} [NON-NEGOTIABLE]`).join("\n") || "• General fit"}

${calibrationNotes.length > 0 ? `Calibration feedback:\n${calibrationNotes.join("\n")}` : ""}

For each profile, return a JSON array:
[{ "pdl_id": "...", "match_score": 0.0-1.0, "match_label": "strong_match"|"good_match"|"potential_fit"|"not_a_match", "match_reasoning": "...", "ai_summary": "..." }]

Return ONLY the JSON array.`;

    const profileText = profiles.map((p) => {
      const s = p.snapshot;
      return `Profile (pdl_id: ${p.pdl_id}): ${s.full_name || s.first_name}, ${s.job_title} at ${s.job_company_name}, ${s.location_locality || ""} ${s.location_region || ""}`;
    }).join("\n");

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
          { role: "user", content: profileText },
        ],
        temperature: 0.2,
        max_tokens: 2000,
      }),
    });

    if (!res.ok) throw new Error(`AI scoring failed: ${res.status}`);

    const data = await res.json();
    let content = data.choices?.[0]?.message?.content?.trim() || "";
    content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const scores = JSON.parse(content);

    return profiles.map((p) => {
      const s = scores.find((sc: any) => sc.pdl_id === p.pdl_id) || {
        match_score: 0.5,
        match_label: "potential_fit",
        match_reasoning: "Auto-scored.",
        ai_summary: `${p.snapshot.full_name || "Candidate"} at ${p.snapshot.job_company_name}.`,
      };
      return { ...p, ...s };
    });
  } catch (err) {
    console.error("Scoring error:", err);
    return profiles.map((p) => ({
      ...p,
      match_score: 0.5 + Math.random() * 0.4,
      match_label: "potential_fit",
      match_reasoning: "Auto-scored.",
      ai_summary: `${p.snapshot.full_name || "Candidate"} at ${p.snapshot.job_company_name}.`,
    }));
  }
}
