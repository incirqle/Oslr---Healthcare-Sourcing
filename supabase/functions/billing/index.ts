// Billing: Starter and Pro checkout (monthly or yearly), billing portal, and paid-credit sync.
// Every paid plan invoice grants its credits exactly once (keyed by invoice id).
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders as cors } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";

import { type Account, creditsForSeats, monthIndex, PLANS, PRICE_IDS, priceFor, type Interval, type PlanId } from "../_shared/plans.ts";

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

    const parsed = z.object({ action: z.enum(["status", "checkout", "portal", "upgrade", "invoices", "invoice_pdf", "catalog", "redeem_code"]).optional(), origin: z.string().url().optional(), plan: z.enum(["starter", "pro", "beta"]).optional(), interval: z.enum(["month", "year"]).optional(), embedded: z.boolean().optional(), invoice_id: z.string().regex(/^in_[A-Za-z0-9]+$/).optional(), code: z.string().max(64).optional() }).safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({ error: "Invalid billing request." }, 400);
    const body = parsed.data;
    const action = body?.action;
    const { data: isAdmin } = await db.rpc("has_company_role", { _user_id: user.id, _company_id: companyId, _role: "admin" });
    if (["checkout", "portal", "upgrade", "invoices", "invoice_pdf"].includes(action ?? "") && !isAdmin) return json({ error: "Only workspace admins can manage billing." }, 403);
    // Preserve hand-granted Enterprise access without inventing a Stripe subscription or pool.
    if (!action || action === "status") {
      const [{ data: exemption }, { data: features }] = await Promise.all([
        db.from("billing_exemptions").select("company_id").eq("company_id", companyId).maybeSingle(),
        db.from("company_features").select("plan").eq("company_id", companyId).maybeSingle(),
      ]);
      if (exemption && features?.plan === "enterprise") {
        const [{ count }, { data: credits }] = await Promise.all([
          db.from("profiles").select("user_id", { count: "exact", head: true }).eq("company_id", companyId),
          db.from("credit_balances").select("monthly_allowance").eq("company_id", companyId).maybeSingle(),
        ]);
        return json({ subscribed: false, exempt: true, plan: "enterprise", status: "granted", interval: null,
          renews_at: null, cancel_at_period_end: false, seats: null, seats_used: count ?? 0,
          monthly_credits: credits?.monthly_allowance ?? 0, granted: 0 });
      }
    }
    const requestedOrigin = body.origin ? new URL(body.origin).origin : "https://oslr.health";
    const origin = requestedOrigin === "https://oslr.health" || requestedOrigin === "http://localhost:8080" || /^https:\/\/[a-z0-9-]+\.lovable\.app$/.test(requestedOrigin) ? requestedOrigin : "https://oslr.health";
    const api = { apiVersion: "2025-08-27.basil" } as const;
    const oslr = new Stripe(Deno.env.get("STRIPE_OSLR_SECRET_KEY")!, api);
    const legacyKey = Deno.env.get("STRIPE_SECRET_KEY");
    const legacy = legacyKey ? new Stripe(legacyKey, api) : null;

    // Customer is per workspace; reuse by metadata, then email.
    const findCustomer = async (s: Stripe) => {
      const found = await s.customers.search({ query: `metadata['company_id']:'${companyId}'`, limit: 1 }).catch(() => null);
      let id = found?.data[0]?.id;
      if (!id && isAdmin) {
        const byEmail = await s.customers.list({ email: user.email, limit: 1 });
        id = byEmail.data[0]?.id;
        if (id) {
          const customer = byEmail.data[0];
          if (customer.metadata.company_id && customer.metadata.company_id !== companyId) return undefined;
          await s.customers.update(id, { metadata: { company_id: companyId } });
        }
      }
      return id;
    };
    const hasLivePlan = async (s: Stripe, id: string) => {
      const subs = await s.subscriptions.list({ customer: id, status: "all", limit: 10 });
      return subs.data.some((x) => ["active", "trialing", "past_due"].includes(x.status) && x.items.data.some((i) => PRICE_IDS[i.price.id]));
    };
    // Existing customers with a live plan on the old Pitchsink account stay there; everyone else uses Oslr.
    let stripe: Stripe = oslr;
    let account: Account = "oslr";
    let customerId = await findCustomer(oslr);
    if (legacy && !(customerId && await hasLivePlan(oslr, customerId))) {
      const legacyId = await findCustomer(legacy).catch(() => undefined);
      if (legacyId && await hasLivePlan(legacy, legacyId).catch(() => false)) {
        stripe = legacy; account = "legacy"; customerId = legacyId;
      }
    }

    const email = user.email.toLowerCase();
    const { data: betaRow } = await db.from("beta_plan_invites").select("email").eq("email", email).maybeSingle();
    let betaEligible = !!betaRow;

    // "OSLR BETA" unlocks the flat $115/month Starter price for this email. Spaces and case are ignored.
    if (action === "redeem_code") {
      const normalized = (body.code ?? "").replace(/[\s_-]+/g, "").toLowerCase();
      if (normalized !== "oslrbeta") return json({ ok: false });
      if (!betaEligible) {
        const { error } = await db.from("beta_plan_invites").upsert({ email, note: "Redeemed OSLR BETA code" }, { onConflict: "email" });
        if (error) return json({ error: "That code couldn't be used right now. Try again." }, 500);
        betaEligible = true;
      }
      return json({ ok: true });
    }

    if (action === "catalog") {
      const plans = await Promise.all((["starter", "pro", ...(betaEligible ? ["beta"] : [])] as PlanId[]).map(async (plan) => {
        const prices = await Promise.all((plan === "beta" ? ["month"] : ["month", "year"]).map(async (interval) => {
          const price = await stripe.prices.retrieve(priceFor(plan, interval as Interval, account));
          return { interval, amount: price.unit_amount, currency: price.currency };
        }));
        return { id: plan, ...PLANS[plan], prices, contact_costs: PLANS[plan].prices };
      }));
      return json({ plans });
    }
    if (action === "invoices") {
      if (!customerId) return json({ invoices: [], payment_method: null });
      const invoices = await stripe.invoices.list({ customer: customerId, limit: 12 });
      const customer = await stripe.customers.retrieve(customerId, { expand: ["invoice_settings.default_payment_method"] });
      const method = !customer.deleted ? customer.invoice_settings.default_payment_method : null;
      const card = typeof method === "object" && method ? method.card : null;
      return json({ invoices: invoices.data.map((i) => ({ id: i.id, number: i.number, created: i.created, amount: i.total, currency: i.currency, status: i.status, hosted_url: i.hosted_invoice_url, has_pdf: !!i.invoice_pdf })), payment_method: card ? { brand: card.brand, last4: card.last4, exp_month: card.exp_month, exp_year: card.exp_year } : null });
    }
    if (action === "invoice_pdf") {
      if (!customerId || !body.invoice_id) return json({ error: "Invoice not found." }, 404);
      const invoice = await stripe.invoices.retrieve(body.invoice_id);
      const invoiceCustomer = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
      if (invoiceCustomer !== customerId || !invoice.invoice_pdf) return json({ error: "Invoice not found." }, 404);
      const file = await fetch(invoice.invoice_pdf);
      if (!file.ok) return json({ error: "Invoice download is unavailable." }, 502);
      return new Response(await file.arrayBuffer(), { headers: { ...cors, "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="oslr-invoice-${invoice.id}.pdf"` } });
    }

    if (action === "checkout") {
      if (account === "legacy") return json({ error: "Your workspace already has a plan. Use Manage billing to change it." }, 400);
      if (!customerId) {
        customerId = (await stripe.customers.create({ email: user.email, metadata: { company_id: companyId } })).id;
      }
      const active = await stripe.subscriptions.list({ customer: customerId, status: "active", limit: 1 });
      if (active.data.length) return json({ error: "Your workspace already has a plan. Use Manage billing to change it." }, 400);
      let plan: PlanId = body?.plan === "pro" ? "pro" : body?.plan === "beta" ? "beta" : "starter";
      // Beta code holders always get Starter at the flat $115 monthly price.
      if (plan === "starter" && betaEligible) plan = "beta";
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
      if (!customerId) return undefined;
      const subs = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 10 });
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
        items: [{ id: item.id, price: priceFor("pro", interval, account) }],
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
