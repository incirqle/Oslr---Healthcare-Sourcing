// Billing: Starter plan checkout, billing portal, and paid-credit sync.
// Every paid Starter invoice grants 150 credits exactly once (keyed by invoice id).
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const STARTER_PRICE = "price_1UPqrsIIdDz6ofU5w98C1smQ";
const MONTHLY_CREDITS = 150;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false },
    });
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: u } = await db.auth.getUser(token);
    const user = u?.user;
    if (!user?.email) return json({ error: "Please sign in again." }, 401);
    const { data: prof } = await db.from("profiles").select("company_id").eq("user_id", user.id).maybeSingle();
    const companyId = prof?.company_id as string | undefined;
    if (!companyId) return json({ error: "No workspace found." }, 400);

    const body = await req.json().catch(() => ({}));
    const action = body?.action;
    const origin = typeof body?.origin === "string" && /^https?:\/\//.test(body.origin) ? body.origin : "https://oslr.health";
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2025-08-27.basil" });

    // Customer is per workspace; reuse by metadata, then email.
    const found = await stripe.customers.search({ query: `metadata['company_id']:'${companyId}'`, limit: 1 }).catch(() => null);
    let customerId = found?.data[0]?.id;
    if (!customerId) {
      const byEmail = await stripe.customers.list({ email: user.email, limit: 1 });
      customerId = byEmail.data[0]?.id;
      if (customerId) await stripe.customers.update(customerId, { metadata: { company_id: companyId } });
    }

    if (action === "checkout") {
      if (!customerId) {
        customerId = (await stripe.customers.create({ email: user.email, metadata: { company_id: companyId } })).id;
      }
      const active = await stripe.subscriptions.list({ customer: customerId, status: "active", limit: 1 });
      if (active.data.length) return json({ error: "Your workspace already has the Starter plan." }, 400);
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: "subscription",
        line_items: [{ price: STARTER_PRICE, quantity: 1 }],
        success_url: `${origin}/credits?checkout=success`,
        cancel_url: `${origin}/credits`,
        subscription_data: { metadata: { company_id: companyId, user_id: user.id } },
        metadata: { company_id: companyId },
      });
      return json({ url: session.url });
    }

    if (action === "portal") {
      if (!customerId) return json({ error: "No billing account yet." }, 400);
      const p = await stripe.billingPortal.sessions.create({ customer: customerId, return_url: `${origin}/credits` });
      return json({ url: p.url });
    }

    // status (default): report plan and grant credits for any paid invoice not yet credited.
    if (!customerId) return json({ subscribed: false, granted: 0 });
    const subs = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 10 });
    const starter = subs.data.find((s: { items: { data: { price: { id: string } }[] } } & { status: string }) =>
      s.items.data.some((i: { price: { id: string } }) => i.price.id === STARTER_PRICE) &&
      ["active", "trialing", "past_due"].includes(s.status));
    const invoices = await stripe.invoices.list({ customer: customerId, status: "paid", limit: 24 });
    let granted = 0;
    for (const inv of invoices.data) {
      const isStarter = inv.lines.data.some((l: { pricing?: { price_details?: { price?: string } }; price?: { id?: string } }) =>
          l.pricing?.price_details?.price === STARTER_PRICE ||
          l.price?.id === STARTER_PRICE
      );
      if (!isStarter || !inv.id || (inv.amount_paid ?? 0) <= 0) continue;
      const { data: ok } = await db.rpc("grant_paid_credits", {
        _company_id: companyId, _amount: MONTHLY_CREDITS, _ref: inv.id, _note: "Starter plan · monthly credits",
      });
      if (ok) granted += MONTHLY_CREDITS;
    }
    const periodEnd = (starter?.items.data[0] as unknown as { current_period_end?: number })?.current_period_end;
    return json({
      subscribed: !!starter,
      status: starter?.status ?? null,
      renews_at: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      cancel_at_period_end: starter?.cancel_at_period_end ?? false,
      granted,
    });
  } catch (e) {
    console.error("billing error", e);
    return json({ error: "Billing is unavailable right now. Try again shortly." }, 500);
  }
});
