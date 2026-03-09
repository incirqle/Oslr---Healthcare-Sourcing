import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function resolveMergeFields(text: string, candidate: Record<string, string | null>): string {
  return text
    .replace(/\{\{full_name\}\}/g, candidate.full_name || "")
    .replace(/\{\{first_name\}\}/g, (candidate.full_name || "").split(" ")[0] || "")
    .replace(/\{\{title\}\}/g, candidate.title || "")
    .replace(/\{\{current_employer\}\}/g, candidate.current_employer || "")
    .replace(/\{\{location\}\}/g, candidate.location || "")
    .replace(/\{\{email\}\}/g, candidate.email || "");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    // Verify auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use authed client to validate user
    const supabaseClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Service role for all DB operations
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { campaign_id } = await req.json();
    if (!campaign_id) {
      return new Response(JSON.stringify({ error: "campaign_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch campaign with template and project
    const { data: campaign, error: campaignError } = await adminClient
      .from("email_campaigns")
      .select("*, email_templates(name, subject, body), projects(id, name, company_id)")
      .eq("id", campaign_id)
      .single();

    if (campaignError || !campaign) {
      return new Response(JSON.stringify({ error: "Campaign not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (campaign.status !== "draft") {
      return new Response(JSON.stringify({ error: "Campaign has already been sent" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const companyId = campaign.company_id;

    // Fetch company sender settings
    const { data: company } = await adminClient
      .from("companies")
      .select("name, from_name, from_email, reply_to_email")
      .eq("id", companyId)
      .single();

    const fromName = company?.from_name || company?.name || "Recruiting Team";
    const fromEmail = company?.from_email || "noreply@example.com";
    const replyTo = company?.reply_to_email;

    // Fetch candidates in the project
    const { data: candidates, error: candidatesError } = await adminClient
      .from("candidates")
      .select("id, full_name, title, current_employer, location, email")
      .eq("project_id", campaign.project_id)
      .not("email", "is", null);

    if (candidatesError) {
      return new Response(JSON.stringify({ error: "Failed to fetch candidates" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const template = campaign.email_templates;
    if (!template) {
      return new Response(JSON.stringify({ error: "Template not found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let sentCount = 0;
    const errors: string[] = [];
    const now = new Date().toISOString();

    if (!resendApiKey) {
      // ─── MOCK MODE ─────────────────────────────────────────────────────────
      // Resend API key not configured yet — simulate sends for demo purposes
      console.log(`[MOCK] Would send ${candidates.length} emails for campaign ${campaign_id}`);
      
      // Record mock "sent" events
      const eventInserts = candidates.map((c) => ({
        campaign_id,
        candidate_id: c.id,
        company_id: companyId,
        event_type: "sent",
        event_data: { mock: true, to: c.email },
      }));

      if (eventInserts.length > 0) {
        await adminClient.from("email_events").insert(eventInserts);
      }
      sentCount = candidates.length;
    } else {
      // ─── LIVE MODE via Resend ───────────────────────────────────────────────
      for (const candidate of candidates) {
        const personalizedSubject = resolveMergeFields(template.subject, candidate);
        const personalizedBody = resolveMergeFields(template.body, candidate);

        // Build HTML email (simple wrapper for now)
        const htmlBody = personalizedBody.replace(/\n/g, "<br />");

        const emailPayload: Record<string, unknown> = {
          from: `${fromName} <${fromEmail}>`,
          to: [candidate.email],
          subject: personalizedSubject,
          html: `<html><body style="font-family:sans-serif;line-height:1.6;max-width:600px;margin:0 auto;padding:20px;">${htmlBody}</body></html>`,
          text: personalizedBody,
          tags: [
            { name: "campaign_id", value: campaign_id },
            { name: "candidate_id", value: candidate.id },
          ],
        };

        if (replyTo) emailPayload.reply_to = replyTo;

        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(emailPayload),
        });

        if (res.ok) {
          sentCount++;
          await adminClient.from("email_events").insert({
            campaign_id,
            candidate_id: candidate.id,
            company_id: companyId,
            event_type: "sent",
            event_data: { to: candidate.email },
          });
        } else {
          const errData = await res.json();
          errors.push(`${candidate.email}: ${errData.message || "send failed"}`);
          console.error(`Failed to send to ${candidate.email}:`, errData);
        }
      }
    }

    // Update campaign status and analytics
    await adminClient
      .from("email_campaigns")
      .update({
        status: "sent",
        sent_at: now,
        sent_count: sentCount,
        recipient_count: candidates.length,
      })
      .eq("id", campaign_id);

    return new Response(
      JSON.stringify({
        success: true,
        sent: sentCount,
        total: candidates.length,
        errors: errors.length > 0 ? errors : undefined,
        mock: !resendApiKey,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("send-campaign error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
