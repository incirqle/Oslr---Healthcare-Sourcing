// Billing: Starter and Pro checkout (monthly or yearly), billing portal, and paid-credit sync.
// Every paid plan invoice grants its credits exactly once (keyed by invoice id).
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

import { creditsForInvoice, PLANS, PRICE_IDS, priceFor, type Interval, type PlanId } from "../_shared/plans.ts";

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
      if (active.data.length) return json({ error: "Your workspace already has a plan. Use Manage billing to change it." }, 400);
      const plan: PlanId = body?.plan === "pro" ? "pro" : "starter";
      const interval: Interval = body?.interval === "year" ? "year" : "month";
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: "subscription",
        line_items: [{ price: priceFor(plan, interval), quantity: 1 }],
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
    type Sub = { status: string; cancel_at_period_end: boolean; items: { data: { price: { id: string }; current_period_end?: number }[] } };
    const live = (subs.data as unknown as Sub[]).find((s) =>
      s.items.data.some((i) => PRICE_IDS[i.price.id]) && ["active", "trialing", "past_due"].includes(s.status));
    const liveInfo = live ? PRICE_IDS[live.items.data.find((i) => PRICE_IDS[i.price.id])!.price.id] : null;
    const invoices = await stripe.invoices.list({ customer: customerId, status: "paid", limit: 24 });
    let granted = 0;
    for (const inv of invoices.data) {
      const line = inv.lines.data.find((l: { pricing?: { price_details?: { price?: string } }; price?: { id?: string } }) =>
        PRICE_IDS[l.pricing?.price_details?.price ?? l.price?.id ?? ""]) as
        { pricing?: { price_details?: { price?: string } }; price?: { id?: string } } | undefined;
      if (!line || !inv.id || (inv.amount_paid ?? 0) <= 0) continue;
      const info = PRICE_IDS[line.pricing?.price_details?.price ?? line.price?.id ?? ""];
      const amount = creditsForInvoice(info.plan, info.interval);
      const label = info.plan === "pro" ? "Pro" : "Starter";
      const { data: ok } = await db.rpc("grant_paid_credits", {
        _company_id: companyId, _amount: amount, _ref: inv.id,
        _note: `${label} plan · ${info.interval === "year" ? "yearly" : "monthly"} credits`,
      });
      if (ok) granted += amount;
    }
    // Record the plan; Pro switches Agents on. Never switch off a hand-granted Agents pass.
    const plan: PlanId = liveInfo?.plan ?? "starter";
    const patch: Record<string, unknown> = { company_id: companyId, plan, updated_at: new Date().toISOString() };
    if (PLANS[plan].agents) patch.agents_enabled = true;
    await db.from("company_features").upsert(patch, { onConflict: "company_id" });
    const periodEnd = live?.items.data[0]?.current_period_end;
    return json({
      subscribed: !!live,
      plan: live ? plan : null,
      interval: liveInfo?.interval ?? null,
      status: live?.status ?? null,
      renews_at: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      cancel_at_period_end: live?.cancel_at_period_end ?? false,
      granted,
    });
  } catch (e) {
    console.error("billing error", e);
    return json({ error: "Billing is unavailable right now. Try again shortly." }, 500);
  }
});
