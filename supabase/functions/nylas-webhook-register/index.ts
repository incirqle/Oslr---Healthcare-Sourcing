// One-shot edge function to (re)register the Nylas webhook for this project.
// Called manually by an admin. Idempotent — if a webhook already targets our
// URL, returns the existing one.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { nylasFetch, projectRef } from "../_shared/nylas.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EVENTS = [
  "message.opened",
  "message.link_clicked",
  "message.bounce_detected",
  "thread.replied",
  "message.created",
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const webhookUrl = `https://${projectRef()}.supabase.co/functions/v1/nylas-webhook`;

    // List existing webhooks
    const listRes = await nylasFetch("/v3/webhooks");
    const list = await listRes.json();
    const existing = (list?.data ?? []).find(
      (w: { webhook_url?: string }) => w.webhook_url === webhookUrl,
    );

    if (existing) {
      return new Response(
        JSON.stringify({ status: "exists", webhook: existing }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const createRes = await nylasFetch("/v3/webhooks", {
      method: "POST",
      body: JSON.stringify({
        trigger_types: EVENTS,
        webhook_url: webhookUrl,
        description: "Oslr campaign tracking",
        notification_email_addresses: [],
      }),
    });
    const json = await createRes.json();
    if (!createRes.ok) {
      return new Response(
        JSON.stringify({ error: "nylas_create_failed", detail: json }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    return new Response(
      JSON.stringify({ status: "created", webhook: json?.data ?? json }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
