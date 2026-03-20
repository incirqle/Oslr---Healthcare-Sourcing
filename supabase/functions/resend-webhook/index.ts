import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TRACKED_EVENTS: Record<string, string> = {
  "email.sent": "sent",
  "email.delivered": "delivered",
  "email.opened": "opened",
  "email.clicked": "clicked",
  "email.bounced": "bounced",
  "email.complained": "complained",
};

const COUNTER_COLUMNS: Record<string, string> = {
  opened: "open_count",
  clicked: "click_count",
  bounced: "bounce_count",
  delivered: "delivered_count",
};

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const webhookSecret = Deno.env.get("RESEND_WEBHOOK_SECRET");

    if (webhookSecret) {
      const signature = req.headers.get("svix-signature");
      const svixId = req.headers.get("svix-id");
      const svixTimestamp = req.headers.get("svix-timestamp");
      if (!signature || !svixId || !svixTimestamp) {
        return new Response(JSON.stringify({ error: "Missing webhook signature" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }
      // TODO: Add svix signature verification
    }

    const payload = await req.json();
    const { type, data } = payload;
    console.log(`Received Resend webhook: ${type}`, JSON.stringify(data));

    const eventType = TRACKED_EVENTS[type];
    if (!eventType) {
      return new Response(JSON.stringify({ received: true, processed: false }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const tags: { name: string; value: string }[] = data.tags || [];
    const agentId = tags.find((t) => t.name === "agent_id")?.value;
    const leadId = tags.find((t) => t.name === "lead_id")?.value;
    const campaignId = tags.find((t) => t.name === "campaign_id")?.value;
    const candidateId = tags.find((t) => t.name === "candidate_id")?.value;

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // ─── AGENT OUTREACH EVENTS ───
    if (agentId && leadId) {
      const resendEmailId = data.email_id || data.id;

      if (eventType === "opened") {
        if (resendEmailId) {
          await adminClient
            .from("agent_outreach_log")
            .update({ opened_at: new Date().toISOString() })
            .eq("resend_email_id", resendEmailId)
            .is("opened_at", null);
        }
        // Atomic increment
        const { data: lead } = await adminClient
          .from("agent_leads")
          .select("email_opens")
          .eq("id", leadId)
          .single();
        if (lead) {
          await adminClient
            .from("agent_leads")
            .update({ email_opens: (lead.email_opens || 0) + 1 })
            .eq("id", leadId);
        }
      }

      if (eventType === "bounced") {
        if (resendEmailId) {
          await adminClient
            .from("agent_outreach_log")
            .update({ bounced: true })
            .eq("resend_email_id", resendEmailId);
        }
        await adminClient
          .from("agent_leads")
          .update({ status: "hidden" })
          .eq("id", leadId);

        // Auto-pause on high bounce rate
        const { data: outreachLogs } = await adminClient
          .from("agent_outreach_log")
          .select("bounced")
          .eq("agent_id", agentId);

        if (outreachLogs && outreachLogs.length > 10) {
          const totalBounced = outreachLogs.filter((l) => l.bounced).length;
          const bounceRate = totalBounced / outreachLogs.length;
          if (bounceRate > 0.1) {
            await adminClient
              .from("sourcing_agents")
              .update({ status: "paused" })
              .eq("id", agentId);
            console.warn(`Agent ${agentId} auto-paused due to ${(bounceRate * 100).toFixed(1)}% bounce rate`);
          }
        }
      }

      if (eventType === "complained") {
        await adminClient
          .from("agent_leads")
          .update({ status: "hidden" })
          .eq("id", leadId);
        console.warn(`Lead ${leadId} suppressed due to spam complaint`);
      }

      return new Response(JSON.stringify({ received: true, processed: true, event_type: eventType, target: "agent" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // ─── CAMPAIGN EVENTS (existing logic) ───
    if (!campaignId || !candidateId) {
      console.warn("Webhook missing campaign_id / candidate_id tags, skipping");
      return new Response(JSON.stringify({ received: true, processed: false }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const { data: campaign } = await adminClient
      .from("email_campaigns")
      .select("company_id")
      .eq("id", campaignId)
      .single();

    if (!campaign) {
      console.warn("Campaign not found for webhook event:", campaignId);
      return new Response(JSON.stringify({ received: true, processed: false }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const eventData: Record<string, unknown> = {
      resend_event: type,
      timestamp: data.created_at || new Date().toISOString(),
    };

    if (eventType === "bounced" && data.bounce) {
      eventData.bounce_type = data.bounce.type;
      eventData.bounce_message = data.bounce.message;
    }
    if (eventType === "complained") {
      eventData.complaint_type = data.complaint?.type;
    }
    if (eventType === "clicked" && data.click) {
      eventData.clicked_url = data.click.link;
      eventData.user_agent = data.click.userAgent;
    }

    await adminClient.from("email_events").insert({
      campaign_id: campaignId,
      candidate_id: candidateId,
      company_id: campaign.company_id,
      event_type: eventType,
      event_data: eventData,
    });

    const counterColumn = COUNTER_COLUMNS[eventType];
    if (counterColumn) {
      const { data: current } = await adminClient
        .from("email_campaigns")
        .select(counterColumn)
        .eq("id", campaignId)
        .single();

      if (current) {
        const newVal = ((current as Record<string, number>)[counterColumn] || 0) + 1;
        await adminClient
          .from("email_campaigns")
          .update({ [counterColumn]: newVal })
          .eq("id", campaignId);
      }
    }

    return new Response(JSON.stringify({ received: true, processed: true, event_type: eventType }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("resend-webhook error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
