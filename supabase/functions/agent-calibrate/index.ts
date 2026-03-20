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

    const { agent_id, lead_id, action, feedback } = await req.json();

    // Verify ownership
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

    if (action === "approve") {
      // Update lead status
      await serviceClient
        .from("agent_leads")
        .update({ status: "approved" })
        .eq("id", lead_id);

      const newApproved = (agent.calibration_approved || 0) + 1;

      if (newApproved >= 3) {
        // Lock calibration and activate
        await serviceClient
          .from("sourcing_agents")
          .update({
            calibration_approved: 3,
            calibration_locked: true,
            status: "active",
          })
          .eq("id", agent_id);

        return new Response(
          JSON.stringify({
            calibration_approved: 3,
            calibration_locked: true,
            status: "active",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      await serviceClient
        .from("sourcing_agents")
        .update({ calibration_approved: newApproved })
        .eq("id", agent_id);

      return new Response(
        JSON.stringify({
          calibration_approved: newApproved,
          calibration_locked: false,
          status: "configuring",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "reject") {
      // Update lead
      await serviceClient
        .from("agent_leads")
        .update({ status: "rejected", reviewer_feedback: feedback || null })
        .eq("id", lead_id);

      // Reset calibration counter
      const existingNotes = agent.calibration_notes || [];
      const newNotes = feedback ? [...existingNotes, feedback] : existingNotes;

      await serviceClient
        .from("sourcing_agents")
        .update({
          calibration_approved: 0,
          calibration_notes: newNotes,
        })
        .eq("id", agent_id);

      // Re-parse with calibration notes to refine query
      try {
        const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
        if (lovableApiKey && feedback) {
          const systemPrompt = `You are a clinical healthcare recruiting assistant. The recruiter originally described this role:
"${agent.role_description}"

They have provided this rejection feedback for candidates that didn't fit:
${newNotes.map((n: string) => `- ${n}`).join("\n")}

Return an updated JSON search payload. Return ONLY valid JSON:
{
  "clinical_role": "physician" | "np" | "pa" | "crna" | "rn" | "allied_health" | "admin" | "general",
  "specialty": string | null,
  "practice_setting": string | null,
  "employer": string | null,
  "location": { "city": string | null, "metro": string | null, "state": string | null },
  "salary_min": number | null,
  "salary_max": number | null,
  "tenure_min_years": number | null,
  "active_status": "current" | "past" | "any"
}`;

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
                { role: "user", content: `Recalibrate the search based on the rejection feedback.` },
              ],
              temperature: 0.1,
              max_tokens: 500,
            }),
          });

          if (res.ok) {
            const data = await res.json();
            let content = data.choices?.[0]?.message?.content?.trim() || "";
            content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
            const updatedPayload = JSON.parse(content);

            await serviceClient
              .from("sourcing_agents")
              .update({ parsed_payload: updatedPayload })
              .eq("id", agent_id);
          }
        }
      } catch (parseErr) {
        console.error("Re-parse failed (non-fatal):", parseErr);
      }

      return new Response(
        JSON.stringify({
          calibration_approved: 0,
          calibration_locked: false,
          status: "configuring",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("agent-calibrate error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
