// Credit-metered contact enrichment.
// Prices depend on the workspace plan (see _shared/plans.ts). Only charged when found.
// Once found, a contact type is stored per workspace and never charged again.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { resolveCaller } from "../_shared/clinician-engine/lib/auth.ts";
import { batchContactEnrich, syncContactEnrich } from "../_shared/clinician-engine/lib/crustdata-v2.ts";
import { combinePrimary, mergeContacts, missingAfterPrimary, pdlEnrichContact } from "../_shared/clinician-engine/lib/contact-waterfall.ts";
import { canLookupContact, contactCharge } from "./contact-policy.ts";

import { contactPrices, type ContactKind } from "../_shared/plans.ts";
export type { ContactKind };
const KINDS: ContactKind[] = ["work_email", "personal_email", "phone"];
const FIELD: Record<ContactKind, string> = {
  work_email: "business_email",
  personal_email: "personal_emails",
  phone: "mobile_phone",
};

interface Stored {
  work_email?: string | null;
  personal_emails?: string[];
  phone_numbers?: string[];
  pdl_id?: string; // linked secondary-provider id, server only

}

function admin() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
}

function has(data: Stored, k: ContactKind): boolean {
  if (k === "work_email") return !!data.work_email;
  if (k === "personal_email") return !!data.personal_emails?.length;
  return !!data.phone_numbers?.length;
}

export async function handleEnrichContact(
  req: Request,
  body: Record<string, unknown>,
): Promise<{ status: number; payload: unknown }> {
  const db = admin();
  const caller = await resolveCaller(db as unknown as Parameters<typeof resolveCaller>[0], req);
  if (!caller) return { status: 401, payload: { error: "Please sign in again." } };

  const { data: prof } = await db.from("profiles").select("company_id").eq("user_id", caller.userId).maybeSingle();
  const companyId = prof?.company_id as string | undefined;
  if (!companyId) return { status: 400, payload: { error: "No workspace found for this account." } };

  const { data: pass } = await db.from("billing_exemptions").select("unlimited_access")
    .eq("company_id", companyId).maybeSingle();
  const unlimited = pass?.unlimited_access === true;
  const { data: feat } = await db.from("company_features").select("plan, billing_hold").eq("company_id", companyId).maybeSingle();
  if (feat?.billing_hold && !unlimited) {
    return { status: 403, payload: { error: "Contact lookups are paused while a billing issue is reviewed. Please contact support@oslr.health." } };
  }
  const PRICES = contactPrices(feat?.plan as string | undefined);

  const url = typeof body.linkedin_url === "string" ? body.linkedin_url.trim().toLowerCase().replace(/\/+$/, "") : "";
  if (!url || url.length > 500) return { status: 400, payload: { error: "A LinkedIn URL is required." } };
  const requested = (Array.isArray(body.kinds) ? body.kinds : []).filter((k): k is ContactKind =>
    typeof k === "string" && (KINDS as string[]).includes(k)
  );
  const candidateName = typeof body.candidate_name === "string" ? body.candidate_name.slice(0, 200) : null;
  const anchorStr = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 200) : null);
  const anchors = { name: candidateName, company: anchorStr(body.candidate_company), location: anchorStr(body.candidate_location) };

  const { data: unlock } = await db.from("contact_unlocks").select("data, checked")
    .eq("company_id", companyId).eq("linkedin_url", url).maybeSingle();
  const stored: Stored = (unlock?.data as Stored) ?? {};
  const checked: Record<string, string> = (unlock?.checked as Record<string, string>) ?? {};

  const { data: bal } = await db.from("credit_balances").select("balance").eq("company_id", companyId).maybeSingle();
  let balance = (bal?.balance as number | undefined) ?? 0;

  // Skip types already found, or already searched with no result (recently).
  const recent = (k: ContactKind) => checked[k] && Date.now() - Date.parse(checked[k]) < 30 * 864e5;
  const toFetch = requested.filter((k) => !has(stored, k) && !recent(k));

  const summary = () => ({
    contact: { work_email: stored.work_email, personal_emails: stored.personal_emails?.slice(0, 1), phone_numbers: stored.phone_numbers },
    checked,
    balance,
    unlimited,
    prices: PRICES,
  });

  if (!toFetch.length) return { status: 200, payload: { ...summary(), charged: 0 } };

  const maxCost = toFetch.reduce((s, k) => s + PRICES[k], 0);
  if (!canLookupContact(unlimited, balance, maxCost)) {
    return { status: 402, payload: { ...summary(), error: "insufficient_credits", needed: maxCost } };
  }
  if (!unlimited) {
    const { data: remaining, error } = await db.rpc("member_credit_remaining", { _company_id: companyId, _user_id: caller.userId });
    if (error || (typeof remaining === "number" && remaining < maxCost)) {
      return { status: 402, payload: { ...summary(), error: "Your monthly credit limit has been reached. Ask your workspace admin to raise it." } };
    }
  }

  // Primary provider: instant lookup first (verified work emails only). Only
  // the kinds it missed (or all, if it errored) go to the batch pipeline.
  const wanted = toFetch.map((k) => FIELD[k]);
  const syncRes = await syncContactEnrich([url], wanted);
  const syncHit = syncRes.ok ? syncRes.data[0] ?? null : null;
  let primary = syncHit;
  let res: { ok: boolean } = syncRes;
  const syncMissing = syncRes.ok ? missingAfterPrimary(toFetch, syncHit, candidateName) : (syncRes.insufficientCredits ? [] : toFetch);
  if (syncMissing.length) {
    if (!syncRes.ok) console.warn(`[enrich_contact] sync lookup failed (${syncRes.status}): ${syncRes.detail.slice(0, 200)}; sending to batch`);
    const batchRes = await batchContactEnrich([{ linkedin_url: url }], syncMissing.map((k) => FIELD[k]));
    if (batchRes.ok) { primary = combinePrimary(syncHit, batchRes.data[0] ?? null); res = { ok: true }; }
    else console.warn(`[enrich_contact] batch lookup failed (${batchRes.status}): ${batchRes.detail.slice(0, 200)}`);
  }

  // Secondary provider only for what the primary left empty.
  const missing = missingAfterPrimary(toFetch, primary, candidateName);
  let secondary = null;
  let secondaryFailed = false;
  if (missing.length) {
    const s = await pdlEnrichContact(url, missing, stored.pdl_id ?? null, fetch, anchors);
    if (s.ok) secondary = s.contact;
    else secondaryFailed = s.reason === "unavailable";
  }
  if (!res.ok && (secondaryFailed || !secondary)) {
    return { status: 502, payload: { ...summary(), error: "Contact lookup is unavailable right now. Try again shortly." } };
  }
  if (secondary?.pdl_id) stored.pdl_id = secondary.pdl_id;
  const merged = mergeContacts(toFetch, primary, secondary, candidateName);

  const found: ContactKind[] = [];
  const now = new Date().toISOString();
  for (const k of toFetch) {
    checked[k] = now;
    if (k === "work_email" && merged.work_email) { stored.work_email = merged.work_email; found.push(k); }
    if (k === "personal_email" && merged.personal_email) { stored.personal_emails = [merged.personal_email]; found.push(k); }
    if (k === "phone" && merged.phones?.length) { stored.phone_numbers = merged.phones; found.push(k); }
  }
  const sources = merged.sources;
  if (Object.keys(sources).length) console.log(`[enrich_contact] sources ${JSON.stringify(sources)}`);

  const charge = contactCharge(unlimited, found.map((k) => PRICES[k]));
  if (charge > 0) {
    const { data: newBal, error } = await db.rpc("charge_contact_credits", {
      _company_id: companyId, _user_id: caller.userId,
      _kinds: found.map((k) => ({ kind: k, cost: PRICES[k] })),
      _candidate_name: candidateName, _linkedin_url: url,
    });
    if (error) return { status: 402, payload: { ...summary(), error: error.message.includes("monthly credit limit") ? "Your monthly credit limit has been reached. Ask your workspace admin to raise it." : "insufficient_credits", needed: charge } };
    balance = newBal as number;
  }

  await db.from("contact_unlocks").upsert({
    company_id: companyId, linkedin_url: url, data: stored, checked, updated_at: now,
  });

  return { status: 200, payload: { ...summary(), charged: charge, found } };
}
