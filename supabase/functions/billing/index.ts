// Billing: Starter and Pro checkout (monthly or yearly), billing portal, and paid-credit sync.
// Every paid plan invoice grants its credits exactly once (keyed by invoice id).
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

import { creditsForSeats, monthIndex, PLANS, PRICE_IDS, priceFor, type Interval, type PlanId } from "../_shared/plans.ts";

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

    const email = user.email.toLowerCase();
    const { data: betaRow } = await db.from("beta_plan_invites").select("email").eq("email", email).maybeSingle();
    const betaEligible = !!betaRow;

    if (action === "checkout") {
      if (!customerId) {
        customerId = (await stripe.customers.create({ email: user.email, metadata: { company_id: companyId } })).id;
      }
      const active = await stripe.subscriptions.list({ customer: customerId, status: "active", limit: 1 });
      if (active.data.length) return json({ error: "Your workspace already has a plan. Use Manage billing to change it." }, 400);
      const plan: PlanId = body?.plan === "pro" ? "pro" : body?.plan === "beta" ? "beta" : "starter";
      if (plan === "beta" && !betaEligible) return json({ error: "This plan is by invitation only." }, 403);
      const interval: Interval = plan !== "beta" && body?.interval === "year" ? "year" : "month";
      if (body?.embedded === true) {
        // Embedded checkout keeps buyers on oslr.health; Stripe redirects to return_url on completion.
        const session = await stripe.checkout.sessions.create({
          customer: customerId,
          mode: "subscription",
          ui_mode: "embedded",
          line_items: [{ price: priceFor(plan, interval), quantity: 1 }],
          return_url: `${origin}/credits?checkout=success`,
          subscription_data: { metadata: { company_id: companyId, user_id: user.id } },
          metadata: { company_id: companyId },
        });
        return json({ client_secret: session.client_secret });
      }
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

    type Sub = { id: string; status: string; cancel_at_period_end: boolean; items: { data: { id: string; price: { id: string }; current_period_start?: number; current_period_end?: number }[] } };
    const findLive = async () => {
      const subs = await stripe.subscriptions.list({ customer: customerId!, status: "all", limit: 10 });
      return (subs.data as unknown as Sub[]).find((s) =>
        s.items.data.some((i) => PRICE_IDS[i.price.id]) && ["active", "trialing", "past_due"].includes(s.status));
    };

    if (action === "upgrade") {
      if (!customerId) return json({ error: "No billing account yet." }, 400);
      const live = await findLive();
      const item = live?.items.data.find((i) => PRICE_IDS[i.price.id]);
      if (!live || !item) return json({ error: "No active plan to upgrade." }, 400);
      const cur = PRICE_IDS[item.price.id];
      if (cur.plan === "pro") return json({ error: "You are already on Pro." }, 400);
      const interval: Interval = body?.interval === "year" ? "year" : cur.interval;
      await stripe.subscriptions.update(live.id, {
        items: [{ id: item.id, price: priceFor("pro", interval) }],
        proration_behavior: "always_invoice",
        cancel_at_period_end: false,
      });
      return json({ ok: true });
    }

    // status (default): report plan and grant this month's credits once. Unused credits expire each month.
    if (!customerId) return json({ subscribed: false, granted: 0, beta_eligible: betaEligible });
    const live = await findLive();
    const liveItem = live?.items.data.find((i) => PRICE_IDS[i.price.id]);
    const liveInfo = liveItem ? PRICE_IDS[liveItem.price.id] : null;
    let granted = 0;
    // Credits are one shared pool for the whole workspace. Pro grows the pool by 500 per seat in use.
    const { count: seatCount } = await db.from("profiles").select("user_id", { count: "exact", head: true }).eq("company_id", companyId);
    const seatsUsed = Math.max(1, seatCount ?? 1);
    const grant = async (plan: PlanId, ref: string, note: string) => {
      const amount = creditsForSeats(plan, seatsUsed);
      const { data: ok } = await db.rpc("reset_monthly_credits", { _company_id: companyId, _amount: amount, _ref: ref, _note: note });
      if (ok) granted = amount;
    };
    const label = (p: PlanId) => (p === "pro" ? "Pro" : p === "beta" ? "Early access" : "Starter");
    if (live && liveInfo && liveItem) {
      if (liveInfo.interval === "year") {
        // Yearly: one month of credits at a time, keyed by month within the paid year.
        const start = (liveItem.current_period_start ?? 0) * 1000;
        const k = monthIndex(start, Date.now());
        await grant(liveInfo.plan, `${live.id}:${liveItem.current_period_start}:${k}`, `${label(liveInfo.plan)} plan · monthly credits`);
      } else {
        // Monthly: the latest paid invoice for this subscription grants that month's credits.
        const invoices = await stripe.invoices.list({ customer: customerId, subscription: live.id, status: "paid", limit: 1 });
        const inv = invoices.data[0];
        if (inv?.id && (inv.amount_paid ?? 0) > 0) await grant(liveInfo.plan, inv.id, `${label(liveInfo.plan)} plan · monthly credits`);
      }
    }
    // Record the plan; Pro switches Agents on. Never switch off a hand-granted Agents pass.
    const plan: PlanId = liveInfo?.plan ?? "starter";
    const patch: Record<string, unknown> = { company_id: companyId, plan, updated_at: new Date().toISOString() };
    if (PLANS[plan].agents) patch.agents_enabled = true;
    await db.from("company_features").upsert(patch, { onConflict: "company_id" });
    const periodEnd = liveItem?.current_period_end;
    return json({
      subscribed: !!live,
      plan: live ? plan : null,
      interval: liveInfo?.interval ?? null,
      status: live?.status ?? null,
      renews_at: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      cancel_at_period_end: live?.cancel_at_period_end ?? false,
      seats: PLANS[plan].seats,
      seats_used: seatsUsed,
      monthly_credits: creditsForSeats(plan, seatsUsed),
      beta_eligible: betaEligible,
      granted,
    });
  } catch (e) {
    console.error("billing error", e);
    return json({ error: "Billing is unavailable right now. Try again shortly." }, 500);
  }
});
