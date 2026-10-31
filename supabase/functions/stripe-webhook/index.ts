// Stripe lifecycle: abandoned checkouts, cancellations, win-backs, failed payments, refunds, disputes.
// POST from Stripe (signed) records + reacts to the event. POST {"tick":true} sends nudges that are due.
// Every event is stored once by Stripe event id, so retries never double-act.
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const api = { apiVersion: "2025-08-27.basil" } as const;
const DAY = 86400_000;
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const crypto = Stripe.createSubtleCryptoProvider();

const ok = (b: unknown = { received: true }, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });

const COPY: Record<string, { subject: string; body: string }> = {
  abandoned_cart: { subject: "Your Oslr plan is one step away", body: "You started setting up Oslr but didn't finish checkout. Your workspace is ready whenever you are." },
  cancel_scheduled: { subject: "Your Oslr plan is set to end", body: "Your plan stays active, with your credits, until the end of this billing period. Changed your mind? You can keep your plan from Billing at any time." },
  payment_failed: { subject: "Your Oslr payment didn't go through", body: "We couldn't charge your card for Oslr. Please update your payment details in Billing so your searches and credits keep working." },
  winback_3: { subject: "Your Oslr projects are still saved", body: "Your projects, saved clinicians and search history are all still here. Pick a plan to start searching again." },
  winback_14: { subject: "Ready to find your next clinician?", body: "Oslr covers more than 5.1 million U.S. healthcare profiles. Come back any time; everything you saved is waiting." },
  refund: { subject: "Your Oslr refund is on its way", body: "We've issued your refund. It usually shows on your statement within 5 to 10 business days." },
};

async function sendEmail(to: string, subject: string, text: string): Promise<string | null> {
  const key = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("BILLING_FROM_EMAIL");
  if (!key || !from) return "email_not_configured";
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#111"><p>${text}</p><p><a href="https://oslr.health/credits">Open Oslr</a></p><p style="color:#777;font-size:12px">Oslr · oslr.health</p></div>`;
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject, html }),
  });
  return r.ok ? null : `resend_${r.status}: ${(await r.text()).slice(0, 300)}`;
}

async function alertOwner(subject: string, text: string) {
  const to = Deno.env.get("OSLR_ALERT_EMAIL");
  if (to) await sendEmail(to, `[Oslr billing] ${subject}`, text);
}

async function queue(companyId: string | null, email: string | null | undefined, kind: string, key: string, delayDays = 0) {
  if (!email) return;
  await db.from("billing_nudges").upsert(
    { company_id: companyId, email, kind, dedupe_key: key, send_after: new Date(Date.now() + delayDays * DAY).toISOString() },
    { onConflict: "dedupe_key", ignoreDuplicates: true },
  );
}

async function cancelNudges(companyId: string, kinds: string[]) {
  await db.from("billing_nudges").update({ canceled_at: new Date().toISOString() })
    .eq("company_id", companyId).in("kind", kinds).is("sent_at", null).is("canceled_at", null);
}

async function setFeatures(companyId: string, patch: Record<string, unknown>) {
  await db.from("company_features").upsert({ company_id: companyId, ...patch, updated_at: new Date().toISOString() }, { onConflict: "company_id" });
}

async function companyFor(stripe: Stripe, meta: Record<string, string> | null | undefined, customer: string | Stripe.Customer | Stripe.DeletedCustomer | null | undefined) {
  if (meta?.company_id) return meta.company_id;
  const id = typeof customer === "string" ? customer : customer?.id;
  if (!id) return null;
  const c = await stripe.customers.retrieve(id).catch(() => null);
  return c && !("deleted" in c && c.deleted) ? (c as Stripe.Customer).metadata?.company_id ?? null : null;
}

async function emailFor(stripe: Stripe, customer: string | Stripe.Customer | Stripe.DeletedCustomer | null | undefined) {
  const id = typeof customer === "string" ? customer : customer?.id;
  if (!id) return null;
  const c = await stripe.customers.retrieve(id).catch(() => null);
  return c && !("deleted" in c && c.deleted) ? (c as Stripe.Customer).email : null;
}

async function handle(stripe: Stripe, ev: Stripe.Event): Promise<string | null> {
  const o = ev.data.object as unknown as Record<string, any>;
  switch (ev.type) {
    case "checkout.session.completed": {
      const cid = await companyFor(stripe, o.metadata, o.customer);
      if (cid) await cancelNudges(cid, ["abandoned_cart", "winback_3", "winback_14"]);
      return cid;
    }
    case "checkout.session.expired": {
      const cid = await companyFor(stripe, o.metadata, o.customer);
      const email = o.customer_details?.email ?? o.customer_email ?? await emailFor(stripe, o.customer);
      // Skip if they paid through another session in the meantime.
      if (cid) {
        const { data: f } = await db.from("company_features").select("plan").eq("company_id", cid).maybeSingle();
        if (f?.plan && f.plan !== "none" && f.plan !== "") return cid;
      }
      await queue(cid, email, "abandoned_cart", `abandoned:${cid ?? email}`, 0);
      return cid;
    }
    case "customer.subscription.updated": {
      const cid = await companyFor(stripe, o.metadata, o.customer);
      if (!cid) return null;
      const was = (ev.data.previous_attributes as Record<string, unknown> | undefined)?.cancel_at_period_end;
      await setFeatures(cid, { cancel_at_period_end: !!o.cancel_at_period_end });
      if (o.cancel_at_period_end && was === false) {
        await queue(cid, await emailFor(stripe, o.customer), "cancel_scheduled", `cancel:${o.id}:${o.cancel_at ?? ""}`);
        await alertOwner("Cancellation scheduled", `Workspace ${cid} scheduled its plan to end.`);
      }
      return cid;
    }
    case "customer.subscription.deleted": {
      const cid = await companyFor(stripe, o.metadata, o.customer);
      if (!cid) return null;
      await setFeatures(cid, { plan: "none", cancel_at_period_end: false, canceled_at: new Date().toISOString() });
      await db.from("clin_agents").update({ status: "paused", pause_reason: "Plan ended" }).eq("company_id", cid).in("status", ["calibrating", "sourcing"]);
      const email = await emailFor(stripe, o.customer);
      await queue(cid, email, "winback_3", `winback3:${o.id}`, 3);
      await queue(cid, email, "winback_14", `winback14:${o.id}`, 14);
      await alertOwner("Customer churned", `Workspace ${cid} plan ended. Win-back emails scheduled for day 3 and day 14.`);
      return cid;
    }
    case "invoice.payment_failed": {
      const cid = await companyFor(stripe, o.parent?.subscription_details?.metadata ?? o.metadata, o.customer);
      await queue(cid, o.customer_email ?? await emailFor(stripe, o.customer), "payment_failed", `payfail:${o.id}`);
      return cid;
    }
    case "invoice.paid": {
      const cid = await companyFor(stripe, o.parent?.subscription_details?.metadata ?? o.metadata, o.customer);
      if (cid) await cancelNudges(cid, ["payment_failed", "winback_3", "winback_14", "abandoned_cart"]);
      return cid;
    }
    case "charge.refunded": {
      const cid = await companyFor(stripe, o.metadata, o.customer);
      const full = o.amount_refunded >= o.amount;
      if (cid && full) {
        // A full refund takes back this month's unused credits.
        const { data: bal } = await db.from("credit_balances").select("balance").eq("company_id", cid).maybeSingle();
        const left = (bal?.balance as number | undefined) ?? 0;
        if (left > 0) {
          const { error } = await db.from("credit_transactions").insert({ company_id: cid, kind: "refund", credits: -left, note: "Payment refunded", stripe_ref: `refund:${o.id}` });
          if (!error) await db.from("credit_balances").update({ balance: 0, updated_at: new Date().toISOString() }).eq("company_id", cid);
        }
      }
      await queue(cid, o.billing_details?.email ?? await emailFor(stripe, o.customer), "refund", `refund:${o.id}:${o.amount_refunded}`);
      await alertOwner("Refund issued", `Workspace ${cid ?? "unknown"} refunded $${(o.amount_refunded / 100).toFixed(2)}${full ? " (full, credits removed)" : " (partial)"}.`);
      return cid;
    }
    case "charge.dispute.created":
    case "charge.dispute.updated":
    case "charge.dispute.closed": {
      const charge = typeof o.charge === "string" ? await stripe.charges.retrieve(o.charge).catch(() => null) : o.charge;
      const cid = await companyFor(stripe, charge?.metadata, charge?.customer);
      if (cid) {
        if (ev.type === "charge.dispute.closed") {
          await setFeatures(cid, { billing_hold: o.status === "won" ? null : "dispute_lost" });
        } else {
          await setFeatures(cid, { billing_hold: "dispute" });
          await db.from("clin_agents").update({ status: "paused", pause_reason: "Billing on hold" }).eq("company_id", cid).in("status", ["calibrating", "sourcing"]);
        }
      }
      const due = o.evidence_details?.due_by ? new Date(o.evidence_details.due_by * 1000).toDateString() : "see Stripe";
      await alertOwner(`Chargeback ${ev.type.split(".").pop()}`,
        `Workspace ${cid ?? "unknown"}: $${(o.amount / 100).toFixed(2)}, reason "${o.reason}", status "${o.status}". Evidence due: ${due}. Contact lookups and agents are frozen while open.`);
      return cid;
    }
  }
  return null;
}

async function tick() {
  const { data: due } = await db.from("billing_nudges").select("*")
    .is("sent_at", null).is("canceled_at", null).lte("send_after", new Date().toISOString()).limit(50);
  let sent = 0;
  for (const n of due ?? []) {
    // Win-backs stop the moment they're paying again.
    if (n.kind.startsWith("winback") && n.company_id) {
      const { data: f } = await db.from("company_features").select("plan").eq("company_id", n.company_id).maybeSingle();
      if (f?.plan && f.plan !== "none") { await db.from("billing_nudges").update({ canceled_at: new Date().toISOString() }).eq("id", n.id); continue; }
    }
    const c = COPY[n.kind];
    const err = c ? await sendEmail(n.email, c.subject, c.body) : "unknown_kind";
    if (err === "email_not_configured") break; // keep queued until a sender exists
    await db.from("billing_nudges").update(err ? { error: err } : { sent_at: new Date().toISOString(), error: null }).eq("id", n.id);
    if (!err) sent++;
  }
  return { due: due?.length ?? 0, sent };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return ok({ error: "POST only" }, 405);
  const raw = await req.text();
  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    try { if (JSON.parse(raw)?.tick) return ok(await tick()); } catch { /* fallthrough */ }
    return ok({ error: "Missing signature" }, 400);
  }
  const accounts: { name: string; key?: string; secret?: string }[] = [
    { name: "oslr", key: Deno.env.get("STRIPE_OSLR_SECRET_KEY"), secret: Deno.env.get("STRIPE_OSLR_WEBHOOK_SECRET") },
    { name: "legacy", key: Deno.env.get("STRIPE_SECRET_KEY"), secret: Deno.env.get("STRIPE_LEGACY_WEBHOOK_SECRET") },
  ];
  for (const a of accounts) {
    if (!a.key || !a.secret) continue;
    const stripe = new Stripe(a.key, api);
    let ev: Stripe.Event;
    try { ev = await stripe.webhooks.constructEventAsync(raw, sig, a.secret, undefined, crypto); } catch { continue; }
    const { error: dup } = await db.from("billing_events").insert({ stripe_event_id: ev.id, account: a.name, type: ev.type, payload: ev.data.object as unknown as Record<string, unknown> });
    if (dup) return ok({ received: true, duplicate: true });
    try {
      const cid = await handle(stripe, ev);
      if (cid) await db.from("billing_events").update({ company_id: cid }).eq("stripe_event_id", ev.id);
      await tick();
    } catch (e) {
      console.error("stripe-webhook handler failed", ev.type, e);
      await db.from("billing_events").delete().eq("stripe_event_id", ev.id); // let Stripe retry
      return ok({ error: "handler_failed" }, 500);
    }
    return ok();
  }
  return ok({ error: "Invalid signature" }, 400);
});
