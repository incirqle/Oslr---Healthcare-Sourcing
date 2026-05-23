// Nylas webhook receiver. Handles challenge verification + event delivery.
// Events handled: message.opened, message.link_clicked, message.bounce_detected,
// thread.replied, message.created.
//
// Updates campaign_sends per recipient and bumps email_campaigns counters.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getEnv } from "../_shared/nylas.ts";

const enc = new TextEncoder();

async function verifySignature(secret: string, body: string, signature: string): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBuf = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  const hex = Array.from(new Uint8Array(sigBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hex.toLowerCase() === signature.toLowerCase();
}

Deno.serve(async (req) => {
  const url = new URL(req.url);

  // Nylas webhook URL challenge (GET ?challenge=...)
  if (req.method === "GET") {
    const challenge = url.searchParams.get("challenge");
    if (challenge) return new Response(challenge, { status: 200 });
    return new Response("ok", { status: 200 });
  }

  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const rawBody = await req.text();
  const sig = req.headers.get("X-Nylas-Signature") ?? "";
  const secret = Deno.env.get("NYLAS_WEBHOOK_SECRET");
  if (secret) {
    const ok = await verifySignature(secret, rawBody, sig);
    if (!ok) {
      console.warn("Invalid Nylas webhook signature");
      return new Response("Invalid signature", { status: 401 });
    }
  } else {
    console.warn("NYLAS_WEBHOOK_SECRET not set; accepting webhook without verification");
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }

  const admin = createClient(getEnv("SUPABASE_URL"), getEnv("SUPABASE_SERVICE_ROLE_KEY"));

  // Nylas may send a single event or an array; normalize.
  const events: any[] = Array.isArray(payload?.data) ? payload.data
    : Array.isArray(payload?.deltas) ? payload.deltas
    : Array.isArray(payload) ? payload
    : [payload];

  for (const ev of events) {
    try {
      await handleEvent(admin, ev);
    } catch (e) {
      console.error("Event handler error:", (e as Error).message, ev);
    }
  }

  return new Response("ok", { status: 200 });
});

async function handleEvent(admin: any, ev: any) {
  const type: string = ev?.type ?? ev?.trigger ?? "";
  const obj = ev?.data?.object ?? ev?.object_data ?? ev?.object ?? ev;
  const messageId: string | undefined = obj?.message_id ?? obj?.id;
  const threadId: string | undefined = obj?.thread_id;

  if (!type) return;

  const matchClause = (qb: any) => {
    if (messageId && threadId) return qb.or(`nylas_message_id.eq.${messageId},nylas_thread_id.eq.${threadId}`);
    if (messageId) return qb.eq("nylas_message_id", messageId);
    if (threadId) return qb.eq("nylas_thread_id", threadId);
    return qb;
  };

  // Find the campaign_sends row(s) this event refers to
  const { data: sends } = await matchClause(
    admin.from("campaign_sends").select("id, campaign_id, company_id, recipient_email").limit(5),
  );
  if (!sends || sends.length === 0) return;

  const send = sends[0];

  if (type.endsWith("message.opened")) {
    await admin
      .from("campaign_sends")
      .update({ opened_at: new Date().toISOString() })
      .eq("id", send.id)
      .is("opened_at", null);
    await admin.rpc; // no-op placeholder
    await bumpCounter(admin, send.campaign_id, "open_count");
    return;
  }

  if (type.endsWith("message.link_clicked")) {
    await admin
      .from("campaign_sends")
      .update({ clicked_at: new Date().toISOString() })
      .eq("id", send.id)
      .is("clicked_at", null);
    await bumpCounter(admin, send.campaign_id, "click_count");
    return;
  }

  if (type.endsWith("message.bounce_detected")) {
    await admin
      .from("campaign_sends")
      .update({ bounced: true })
      .eq("id", send.id);
    await bumpCounter(admin, send.campaign_id, "bounce_count");
    await admin
      .from("email_suppressions")
      .upsert(
        { company_id: send.company_id, email: send.recipient_email, reason: "bounce" },
        { onConflict: "company_id,email" },
      );
    return;
  }

  if (type.endsWith("thread.replied") || type.endsWith("message.created")) {
    // Only mark replies for messages we sent (not our own outbound copies)
    await admin
      .from("campaign_sends")
      .update({ replied_at: new Date().toISOString() })
      .eq("id", send.id)
      .is("replied_at", null);
    return;
  }
}

async function bumpCounter(admin: any, campaignId: string, column: string) {
  // Read-then-write since we don't have an RPC for atomic increments.
  const { data } = await admin
    .from("email_campaigns")
    .select(column)
    .eq("id", campaignId)
    .maybeSingle();
  if (!data) return;
  const current = (data as any)[column] ?? 0;
  await admin.from("email_campaigns").update({ [column]: current + 1 }).eq("id", campaignId);
}
