// Credit-metered contact enrichment.
// Prices: work email 2, personal email 3, phone 5. Only charged when found.
// Once found, a contact type is stored per workspace and never charged again.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { resolveCaller } from "../_shared/clinician-engine/lib/auth.ts";
import { batchContactEnrich, syncContactEnrich } from "../_shared/clinician-engine/lib/crustdata-v2.ts";
import { canLookupContact, contactCharge } from "./contact-policy.ts";

export const PRICES = { work_email: 2, personal_email: 3, phone: 5 } as const;
export type ContactKind = keyof typeof PRICES;
const KINDS = Object.keys(PRICES) as ContactKind[];
const FIELD: Record<ContactKind, string> = {
  work_email: "business_email",
  personal_email: "personal_emails",
  phone: "mobile_phone",
};

interface Stored {
  work_email?: string | null;
  personal_emails?: string[];
  phone_numbers?: string[];
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

  const url = typeof body.linkedin_url === "string" ? body.linkedin_url.trim().toLowerCase().replace(/\/+$/, "") : "";
  if (!url || url.length > 500) return { status: 400, payload: { error: "A LinkedIn URL is required." } };
  const requested = (Array.isArray(body.kinds) ? body.kinds : []).filter((k): k is ContactKind =>
    typeof k === "string" && (KINDS as string[]).includes(k)
  );
  const candidateName = typeof body.candidate_name === "string" ? body.candidate_name.slice(0, 200) : null;

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
    contact: stored,
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

  // Instant lookup first; fall back to the batch pipeline only if it errors.
  const wanted = toFetch.map((k) => FIELD[k]);
  let res = await syncContactEnrich([url], wanted);
  if (!res.ok && !res.insufficientCredits) {
    console.warn(`[enrich_contact] sync lookup failed (${res.status}): ${res.detail.slice(0, 200)} — falling back to batch`);
    res = await batchContactEnrich([{ linkedin_url: url }], wanted);
  }
  if (!res.ok) return { status: 502, payload: { ...summary(), error: "Contact lookup is unavailable right now. Try again shortly." } };
  const r = res.data[0];

  const found: ContactKind[] = [];
  const now = new Date().toISOString();
  for (const k of toFetch) {
    checked[k] = now;
    if (k === "work_email" && r?.business_email) { stored.work_email = r.business_email; found.push(k); }
    if (k === "personal_email" && r?.personal_emails?.length) { stored.personal_emails = r.personal_emails; found.push(k); }
    if (k === "phone" && (r?.mobile_phone || r?.phones?.length)) {
      stored.phone_numbers = [...new Set([r.mobile_phone, ...(r.phones ?? [])].filter((p): p is string => !!p))];
      found.push(k);
    }
  }

  const charge = contactCharge(unlimited, found.map((k) => PRICES[k]));
  if (charge > 0) {
    const { data: newBal, error } = await db.rpc("spend_credits", { _company_id: companyId, _amount: charge });
    if (error) return { status: 402, payload: { ...summary(), error: "insufficient_credits", needed: charge } };
    balance = newBal as number;
    await db.from("credit_transactions").insert(found.map((k) => ({
      company_id: companyId,
      user_id: caller.userId,
      kind: k,
      credits: -PRICES[k],
      candidate_name: candidateName,
      linkedin_url: url,
    })));
  }

  await db.from("contact_unlocks").upsert({
    company_id: companyId, linkedin_url: url, data: stored, checked, updated_at: now,
  });

  return { status: 200, payload: { ...summary(), charged: charge, found } };
}
