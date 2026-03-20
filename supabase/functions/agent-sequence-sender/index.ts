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

    // Get all leads due for next sequence step
    // Step 1: approved leads with sequence_step=0 (never contacted)
    const { data: newLeads } = await serviceClient
      .from("agent_leads")
      .select("*, sourcing_agents!inner(*, agent_sequences(*))")
      .eq("status", "approved")
      .eq("sequence_step", 0)
      .eq("sourcing_agents.sequence_mode", "auto_sequence")
      .not("sourcing_agents.sequence_id", "is", null);

    // Step 2: contacted leads where enough time has passed
    const { data: followUpLeads } = await serviceClient
      .from("agent_leads")
      .select("*, sourcing_agents!inner(*, agent_sequences(*))")
      .eq("status", "contacted")
      .eq("sourcing_agents.sequence_mode", "auto_sequence")
      .not("sourcing_agents.sequence_id", "is", null);

    const allLeads = [...(newLeads || []), ...(followUpLeads || [])];
    let emailsSent = 0;

    for (const lead of allLeads) {
      try {
        const agent = lead.sourcing_agents;
        const sequence = agent?.agent_sequences;
        if (!sequence?.steps) continue;

        const steps = sequence.steps as any[];
        const currentStep = lead.sequence_step;

        if (currentStep >= steps.length) continue; // All steps completed

        const stepTemplate = steps[currentStep];
        if (!stepTemplate) continue;

        // Check delay for follow-up steps
        if (currentStep > 0 && lead.last_contacted_at) {
          const delayMs = (stepTemplate.delay_days || 0) * 24 * 60 * 60 * 1000;
          const elapsed = Date.now() - new Date(lead.last_contacted_at).getTime();
          if (elapsed < delayMs) continue; // Not due yet
        }

        // Get user's sending domain
        const { data: domain } = await serviceClient
          .from("user_sending_domains")
          .select("*")
          .eq("user_id", agent.user_id)
          .eq("is_verified", true)
          .maybeSingle();

        if (!domain) continue; // No verified domain

        const profile = lead.profile_snapshot as any;
        const email = getEmail(profile);
        if (!email) continue;

        // Personalize template
        const subject = personalizeTemplate(stepTemplate.subject_template || "", profile);
        const body = personalizeTemplate(stepTemplate.body_template || "", profile);

        // Send via Resend
        const resendApiKey = Deno.env.get("RESEND_API_KEY");
        if (!resendApiKey) {
          console.log("RESEND_API_KEY not set, skipping send");
          continue;
        }

        const sendRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: `${domain.from_name} <${domain.from_email}>`,
            to: [email],
            subject,
            html: wrapInHtml(body),
            text: body,
            tags: [
              { name: "agent_id", value: agent.id },
              { name: "lead_id", value: lead.id },
              { name: "step", value: String(stepTemplate.step || currentStep + 1) },
            ],
          }),
        });

        if (!sendRes.ok) {
          console.error("Resend send failed:", await sendRes.text());
          continue;
        }

        const sendData = await sendRes.json();

        // Log outreach
        await serviceClient.from("agent_outreach_log").insert({
          agent_id: agent.id,
          lead_id: lead.id,
          user_id: agent.user_id,
          step: stepTemplate.step || currentStep + 1,
          to_email: email,
          subject,
          body,
          from_email: domain.from_email,
          from_name: domain.from_name,
          resend_email_id: sendData.id,
          email_provider: "resend",
        });

        // Update lead
        await serviceClient
          .from("agent_leads")
          .update({
            status: "contacted",
            sequence_step: currentStep + 1,
            last_contacted_at: new Date().toISOString(),
          })
          .eq("id", lead.id);

        // Update agent contacted count
        await serviceClient
          .from("sourcing_agents")
          .update({
            leads_contacted: (agent.leads_contacted || 0) + 1,
          })
          .eq("id", agent.id);

        emailsSent++;
      } catch (leadErr) {
        console.error(`Error sending for lead ${lead.id}:`, leadErr);
      }
    }

    return new Response(
      JSON.stringify({ emails_sent: emailsSent }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("agent-sequence-sender error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function getEmail(profile: any): string | null {
  return profile?.work_email
    || profile?.personal_emails?.[0]
    || profile?.emails?.[0]
    || profile?.email
    || null;
}

function personalizeTemplate(template: string, profile: any): string {
  return template
    .replace(/\{\{first_name\}\}/g, profile?.first_name || "there")
    .replace(/\{\{specialty\}\}/g, extractSpecialty(profile) || "")
    .replace(/\{\{employer\}\}/g, profile?.job_company_name || "your current organization")
    .replace(/\{\{location\}\}/g, formatLocation(profile) || "")
    .replace(/\{\{tenure_badge\}\}/g, computeTenureBadge(profile) || "")
    .replace(/\{\{trend_signal\}\}/g, "")
    .replace(/\{\{salary_range\}\}/g, formatSalaryRange(profile?.inferred_salary) || "")
    .replace(/\{\{current_title\}\}/g, profile?.job_title || "your current role")
    .replace(/\n{3,}/g, "\n\n"); // Clean up blank lines
}

function extractSpecialty(profile: any): string {
  const title = profile?.job_title || "";
  const specialties = ["cardiologist", "neurologist", "oncologist", "surgeon", "internist", "pediatrician"];
  for (const s of specialties) {
    if (title.toLowerCase().includes(s)) return s;
  }
  return title.split(" ")[0] || "";
}

function formatLocation(profile: any): string {
  const parts = [profile?.location_locality, profile?.location_region].filter(Boolean);
  return parts.join(", ");
}

function computeTenureBadge(profile: any): string {
  if (!profile?.job_start_date) return "";
  const start = new Date(profile.job_start_date);
  const years = Math.floor((Date.now() - start.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  return `${years} yrs in role`;
}

function formatSalaryRange(salary: any): string {
  if (!salary) return "";
  const min = salary.min ? `$${Math.round(salary.min / 1000)}k` : "";
  const max = salary.max ? `$${Math.round(salary.max / 1000)}k` : "";
  if (min && max) return `${min}–${max}`;
  if (min) return `${min}+`;
  return "";
}

function wrapInHtml(text: string): string {
  const htmlBody = text.replace(/\n/g, "<br>");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family: Arial, sans-serif; font-size: 14px; color: #333; line-height: 1.5;">${htmlBody}</body></html>`;
}
