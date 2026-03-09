import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Resend webhook event types we care about
const TRACKED_EVENTS: Record<string, string> = {
  "email.sent": "sent",
  "email.delivered": "delivered",
  "email.opened": "opened",
  "email.clicked": "clicked",
  "email.bounced": "bounced",
  "email.complained": "complained",
};

// Counters that trigger campaign aggregate updates
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

    // Verify Resend webhook signature if secret is configured
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

      // TODO: Add svix signature verification once webhook secret is configured
      console.log("Webhook signature headers present, verification pending svix library setup");
    }

    const payload = await req.json();
    const { type, data } = payload;

    console.log(`Received Resend webhook: ${type}`, JSON.stringify(data));

    const eventType = TRACKED_EVENTS[type];
    if (!eventType) {
      // Unrecognised event — acknowledge and ignore
      return new Response(JSON.stringify({ received: true, processed: false }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Extract tags set during send — campaign_id and candidate_id
    const tags: { name: string; value: string }[] = data.tags || [];
    const campaignId = tags.find((t) => t.name === "campaign_id")?.value;
    const candidateId = tags.find((t) => t.name === "candidate_id")?.value;

    if (!campaignId || !candidateId) {
      console.warn("Webhook missing campaign_id / candidate_id tags, skipping");
      return new Response(JSON.stringify({ received: true, processed: false }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Fetch campaign to get company_id
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

    // Build event_data with useful info
    const eventData: Record<string, unknown> = {
      resend_event: type,
      timestamp: data.created_at || new Date().toISOString(),
    };

    // Add bounce-specific info
    if (eventType === "bounced" && data.bounce) {
      eventData.bounce_type = data.bounce.type; // hard/soft
      eventData.bounce_message = data.bounce.message;
    }

    // Add complaint-specific info
    if (eventType === "complained") {
      eventData.complaint_type = data.complaint?.type;
    }

    // Add click-specific info
    if (eventType === "clicked" && data.click) {
      eventData.clicked_url = data.click.link;
      eventData.user_agent = data.click.userAgent;
    }

    // Insert the individual event
    await adminClient.from("email_events").insert({
      campaign_id: campaignId,
      candidate_id: candidateId,
      company_id: campaign.company_id,
      event_type: eventType,
      event_data: eventData,
    });

    // Increment aggregate counter on campaign if applicable
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
