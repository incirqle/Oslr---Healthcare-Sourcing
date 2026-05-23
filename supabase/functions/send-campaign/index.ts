import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendViaNylas } from "../_shared/nylas-send.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Per-provider hourly send caps (conservative defaults).
const HOURLY_CAP: Record<string, number> = {
  google: 80,
  microsoft: 60,
};

function resolveMergeFields(text: string, candidate: Record<string, string | null>): string {
  const fullName = candidate.full_name || "";
  return text
    .replace(/\{\{full_name\}\}/g, fullName)
    .replace(/\{\{first_name\}\}/g, fullName.split(" ")[0] || "")
    .replace(/\{\{title\}\}/g, candidate.title || "")
    .replace(/\{\{current_employer\}\}/g, candidate.current_employer || "")
    .replace(/\{\{location\}\}/g, candidate.location || "")
    .replace(/\{\{email\}\}/g, candidate.email || "");
}

function hourAgoIso(): string {
  return new Date(Date.now() - 60 * 60 * 1000).toISOString();
}

async function genUnsubToken(
  admin: ReturnType<typeof createClient>,
  companyId: string,
  email: string,
  campaignId: string,
): Promise<string> {
  const token = crypto.randomUUID().replace(/-/g, "");
  await admin.from("email_unsubscribe_tokens").insert({
    token,
    company_id: companyId,
    email,
    campaign_id: campaignId,
  });
  return token;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    const admin = createClient(supabaseUrl, serviceRoleKey);

    const { campaign_id } = await req.json();
    if (!campaign_id) {
      return new Response(JSON.stringify({ error: "campaign_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch campaign + template
    const { data: campaign, error: campaignError } = await admin
      .from("email_campaigns")
      .select("*, email_templates(name, subject, body)")
      .eq("id", campaign_id)
      .single();

    if (campaignError || !campaign) {
      return new Response(JSON.stringify({ error: "Campaign not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (campaign.status !== "draft" && campaign.status !== "partial") {
      return new Response(JSON.stringify({ error: "Campaign already sent" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!campaign.mailbox_id) {
      return new Response(JSON.stringify({ error: "mailbox_required" }), {
        status: 400,
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

    const companyId = campaign.company_id as string;

    // Resolve mailbox
    const { data: mailbox } = await admin
      .from("user_mailboxes")
      .select("*")
      .eq("id", campaign.mailbox_id)
      .eq("status", "active")
      .single();
    if (!mailbox) {
      return new Response(JSON.stringify({ error: "mailbox_not_active" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Per-mailbox hourly cap
    const cap = HOURLY_CAP[mailbox.provider] ?? 60;
    const { count: sentLastHour } = await admin
      .from("campaign_sends")
      .select("*", { count: "exact", head: true })
      .eq("company_id", companyId)
      .gte("sent_at", hourAgoIso());
    const remaining = Math.max(0, cap - (sentLastHour ?? 0));
    if (remaining === 0) {
      return new Response(JSON.stringify({
        error: "hourly_cap_reached",
        provider: mailbox.provider,
        cap,
      }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Candidates with an email, excluding suppressions and already-sent
    const { data: candidates } = await admin
      .from("candidates")
      .select("id, full_name, title, current_employer, location, email")
      .eq("project_id", campaign.project_id)
      .not("email", "is", null);
    if (!candidates || candidates.length === 0) {
      return new Response(JSON.stringify({ error: "No recipients" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: suppressions } = await admin
      .from("email_suppressions")
      .select("email")
      .eq("company_id", companyId);
    const suppressed = new Set((suppressions ?? []).map((r) => r.email.toLowerCase()));

    const { data: alreadySent } = await admin
      .from("campaign_sends")
      .select("recipient_email")
      .eq("campaign_id", campaign_id);
    const sentSet = new Set((alreadySent ?? []).map((r) => r.recipient_email.toLowerCase()));

    const eligible = candidates.filter(
      (c) => c.email && !suppressed.has(c.email.toLowerCase()) && !sentSet.has(c.email.toLowerCase()),
    );
    const recipients = eligible.slice(0, remaining);
    const skipped = candidates.length - recipients.length;

    const projectRef = new URL(supabaseUrl).host.split(".")[0];
    const unsubBase = `https://${projectRef}.supabase.co/functions/v1/unsubscribe`;
    const listUnsubscribePost = mailbox.provider === "google";

    let sent = 0;
    const errors: { email: string; error: string }[] = [];

    for (const c of recipients) {
      const personalizedSubject = resolveMergeFields(template.subject, c);
      const personalizedBody = resolveMergeFields(template.body, c);
      const htmlBody = personalizedBody.replace(/\n/g, "<br />");
      const token = await genUnsubToken(admin, companyId, c.email!, campaign_id);
      const unsubUrl = `${unsubBase}?t=${token}`;
      const html = `<html><body style="font-family:sans-serif;line-height:1.6;max-width:600px;margin:0 auto;padding:20px;">${htmlBody}<hr style="margin-top:32px;border:none;border-top:1px solid #eee;"/><p style="font-size:11px;color:#888;">If you'd rather not hear from us, <a href="${unsubUrl}">unsubscribe</a>.</p></body></html>`;

      try {
        const result = await sendViaNylas({
          grantId: mailbox.nylas_grant_id,
          to: [{ email: c.email!, name: c.full_name ?? undefined }],
          subject: personalizedSubject,
          html,
          trackingLabel: `campaign:${campaign_id}`,
          listUnsubscribe: `<mailto:unsubscribe@${mailbox.email.split("@")[1]}?subject=unsubscribe>, <${unsubUrl}>`,
          listUnsubscribePost,
        });
        await admin.from("campaign_sends").insert({
          campaign_id,
          company_id: companyId,
          recipient_email: c.email,
          recipient_name: c.full_name,
          candidate_id: c.id,
          nylas_message_id: result.message_id,
          nylas_thread_id: result.thread_id,
          sent_at: new Date().toISOString(),
        });
        sent++;
      } catch (e) {
        const msg = (e as Error).message;
        errors.push({ email: c.email!, error: msg });
        await admin.from("campaign_sends").insert({
          campaign_id,
          company_id: companyId,
          recipient_email: c.email,
          recipient_name: c.full_name,
          candidate_id: c.id,
          error: msg,
        });
      }
    }

    const isPartial = skipped > 0 || eligible.length > recipients.length;
    await admin
      .from("email_campaigns")
      .update({
        status: isPartial ? "partial" : "sent",
        sent_at: new Date().toISOString(),
        sent_count: (campaign.sent_count ?? 0) + sent,
        recipient_count: candidates.length,
      })
      .eq("id", campaign_id);

    return new Response(
      JSON.stringify({
        success: true,
        sent,
        attempted: recipients.length,
        eligible: eligible.length,
        skipped_suppressed_or_done: candidates.length - eligible.length,
        skipped_cap: Math.max(0, eligible.length - recipients.length),
        hourly_cap: cap,
        provider: mailbox.provider,
        mailbox: mailbox.email,
        errors: errors.length ? errors : undefined,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("send-campaign error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
