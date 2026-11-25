// Credit-metered contact enrichment.
// Prices depend on the workspace plan (see _shared/plans.ts). Only charged when found.
// Once found, a contact type is stored per workspace and never charged again.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { resolveCaller } from "../_shared/clinician-engine/lib/auth.ts";
import { batchContactEnrich, syncContactEnrich, type BatchEnrichResult } from "../_shared/clinician-engine/lib/crustdata-v2.ts";
import { combinePrimary, mergeContacts, missingAfterMerged, missingAfterPrimary, pdlEnrichContact, type MergedContact, type WaterfallKind } from "../_shared/clinician-engine/lib/contact-waterfall.ts";
import { contactOutEnrichContact } from "../_shared/clinician-engine/lib/contactout.ts";
import { observeVerifiedWorkEmail, type WorkEmailSuggestion } from "../_shared/clinician-engine/lib/institution-email-store.ts";
import { researchInstitutionWorkEmail, resolveInstitutionEmployerDomain } from "../_shared/clinician-engine/lib/institution-email-resolver.ts";
import { isInstitutionCandidateDomain } from "../_shared/clinician-engine/lib/institution-election.ts";
import { canLookupContact, contactCharge } from "./contact-policy.ts";
import { employerEmail } from "../_shared/clinician-engine/lib/email-classification.ts";
import { ContactAudit } from "./contact-audit.ts";

import { contactPrices, type ContactKind } from "../_shared/plans.ts";
export type { ContactKind };
const KINDS: ContactKind[] = ["work_email", "personal_email", "phone"];
const FIELD: Record<ContactKind, string> = {
  work_email: "business_email",
  personal_email: "personal_emails",
  phone: "mobile_phone",
};
const CONTACT_RESEARCH_VERSION = 8;

export interface Stored {
  work_email?: string | null;
  // Legacy internal-only value. New successful research is promoted to work_email.
  work_email_suggestion?: WorkEmailSuggestion | null;
  personal_emails?: string[];
  phone_numbers?: string[];
  profile_pic_url?: string | null;
  pdl_id?: string; // linked secondary-provider id, server only
  research_version?: number;
  employer_domain?: string | null;
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

/** Contact facts and a headshot cross the boundary; internal evidence does not. */
export function browserContact(stored: Stored) {
  return {
    work_email: stored.work_email,
    personal_emails: stored.personal_emails?.slice(0, 1),
    phone_numbers: stored.phone_numbers,
    profile_pic_url: stored.profile_pic_url ?? null,
  };
}

/** Old 30-day misses predate dynamic colleague research and get one fresh run. */
export function recentContactMiss(stored: Stored, checked: Record<string, string>, kind: ContactKind, now = Date.now()): boolean {
  if (kind === "work_email" && stored.research_version !== CONTACT_RESEARCH_VERSION) return false;
  return !!checked[kind] && now - Date.parse(checked[kind]) < 30 * 864e5;
}

export function visibleContactChecks(stored: Stored, checked: Record<string, string>): Record<string, string> {
  const visible = { ...checked };
  for (const kind of KINDS) {
    if (!has(stored, kind) && !recentContactMiss(stored, checked, kind)) delete visible[kind];
  }
  return visible;
}

function primaryFields(kinds: ContactKind[], contact: BatchEnrichResult | null, name: string | null, domain?: string | null): ContactKind[] {
  return kinds.filter((k) => !missingAfterPrimary([k], contact, name, domain).length);
}

function mergedFields(kinds: WaterfallKind[], contact: MergedContact): ContactKind[] {
  return kinds.filter((k) => !missingAfterMerged([k], contact).length) as ContactKind[];
}

export function foundContactKinds(kinds: ContactKind[], contact: MergedContact): ContactKind[] {
  return kinds.filter((k) =>
    (k === "work_email" && !!contact.work_email) ||
    (k === "personal_email" && !!contact.personal_email) ||
    (k === "phone" && !!contact.phones?.length)
  );
}

/** Reclassification moves an already-owned address, never creates a new debit. */
export function reclassifyStoredContact(stored: Stored, checked: Record<string, string>, name: string | null, domain: string | null): boolean {
  const email = employerEmail(stored.personal_emails ?? [], domain, name);
  if (!email || (stored.work_email && stored.work_email !== email)) return false;
  stored.work_email = email;
  stored.personal_emails = (stored.personal_emails ?? []).filter(e => e.trim().toLowerCase() !== email);
  if (checked.personal_email) checked.work_email = checked.personal_email;
  if (!stored.personal_emails.length) delete checked.personal_email;
  return true;
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
  const anchors = {
    name: candidateName,
    company: anchorStr(body.candidate_company),
    location: anchorStr(body.candidate_location),
    title: anchorStr(body.candidate_title),
    companyDomain: anchorStr(body.candidate_company_domain),
  };
  const audit = new ContactAudit(db, {
    companyId, userId: caller.userId, linkedinUrl: url, candidateName,
    employer: anchors.company, requested, enabled: requested.length > 0,
  });
  const respond = async (
    status: number,
    payload: Record<string, unknown>,
    outcome: "found" | "not_found" | "cached" | "blocked" | "error",
    error?: string,
  ) => {
    await audit.finish(status, outcome, error);
    return { status, payload };
  };

  const { data: unlock } = await db.from("contact_unlocks").select("data, checked")
    .eq("company_id", companyId).eq("linkedin_url", url).maybeSingle();
  const stored: Stored = (unlock?.data as Stored) ?? {};
  const checked: Record<string, string> = (unlock?.checked as Record<string, string>) ?? {};
  // Confirm domain through server-side organization resolution, never a client
  // assertion. This also repairs misfiled contacts on the normal cached read.
  let confirmedDomain = isInstitutionCandidateDomain(stored.employer_domain);
  if (!confirmedDomain && anchors.company && (requested.includes("work_email") || stored.personal_emails?.length)) {
    try {
      const resolved = await resolveInstitutionEmployerDomain(anchors.company, null);
      if (resolved.unambiguous && resolved.domain) confirmedDomain = resolved.domain;
    } catch { /* sourced provider contacts still work when company research fails */ }
  }
  anchors.companyDomain = confirmedDomain;
  if (confirmedDomain) stored.employer_domain = confirmedDomain;
  if (reclassifyStoredContact(stored, checked, candidateName, confirmedDomain)) {
    audit.step("email_classification", "found", { fields: ["work_email"], detail: "owned_email_reclassified_no_charge" });
    const { error } = await db.from("contact_unlocks").upsert({ company_id: companyId, linkedin_url: url, data: stored, checked, updated_at: new Date().toISOString() });
    if (error) return await respond(500, { error: "Contact information could not be saved. Try again." }, "error", "classification_save_failed");
  }

  const { data: bal } = await db.from("credit_balances").select("balance").eq("company_id", companyId).maybeSingle();
  let balance = (bal?.balance as number | undefined) ?? 0;

  // Skip types already found, or already searched with no result (recently).
  const toFetch = requested.filter((k) => !has(stored, k) && !recentContactMiss(stored, checked, k));

  const summary = () => ({
    contact: browserContact(stored),
    checked: visibleContactChecks(stored, checked),
    balance,
    unlimited,
    prices: PRICES,
  });

  if (!toFetch.length) return await respond(200, { ...summary(), charged: 0 }, "cached");

  const maxCost = toFetch.reduce((s, k) => s + PRICES[k], 0);
  if (!canLookupContact(unlimited, balance, maxCost)) {
    audit.step("credit_check", "blocked", { detail: "insufficient_credits" });
    return await respond(402, { ...summary(), error: "insufficient_credits", needed: maxCost }, "blocked", "insufficient_credits");
  }
  if (!unlimited) {
    const { data: remaining, error } = await db.rpc("member_credit_remaining", { _company_id: companyId, _user_id: caller.userId });
    if (error || (typeof remaining === "number" && remaining < maxCost)) {
      audit.step("credit_check", "blocked", { detail: "member_limit" });
      const message = "Your monthly credit limit has been reached. Ask your workspace admin to raise it.";
      return await respond(402, { ...summary(), error: message }, "blocked", message);
    }
  }
  audit.step("credit_check", "complete");

  // Primary provider: instant lookup first (verified work emails only). Only
  // the kinds it missed (or all, if it errored) go to the batch pipeline.
  const wanted = toFetch.map((k) => FIELD[k]);
  const syncRes = await syncContactEnrich([url], wanted);
  const syncHit = syncRes.ok ? syncRes.data[0] ?? null : null;
  let primary = syncHit;
  let res: { ok: boolean } = syncRes;
  let primaryIncomplete = false;
  if (syncRes.ok) {
    const fields = primaryFields(toFetch, syncHit, candidateName, confirmedDomain);
    audit.step("instant_lookup", fields.length ? "found" : "miss", { fields, httpStatus: 200 });
  } else {
    audit.step("instant_lookup", "unavailable", { httpStatus: syncRes.status });
  }
  const syncMissing = syncRes.ok ? missingAfterPrimary(toFetch, syncHit, candidateName, confirmedDomain) : (syncRes.insufficientCredits ? [] : toFetch);
  if (syncMissing.length) {
    if (!syncRes.ok) console.warn(`[enrich_contact] sync lookup failed (${syncRes.status}): ${syncRes.detail.slice(0, 200)}; sending to batch`);
    const batchRes = await batchContactEnrich([{ linkedin_url: url }], syncMissing.map((k) => FIELD[k]));
    if (batchRes.ok) {
      primary = combinePrimary(syncHit, batchRes.data[0] ?? null);
      res = { ok: true };
      const fields = primaryFields(syncMissing, batchRes.data[0] ?? null, candidateName, confirmedDomain);
      audit.step("batch_lookup", fields.length ? "found" : "miss", { fields, httpStatus: 200 });
    } else {
      primaryIncomplete = true;
      audit.step("batch_lookup", "unavailable", { httpStatus: batchRes.status });
      console.warn(`[enrich_contact] batch lookup failed (${batchRes.status}): ${batchRes.detail.slice(0, 200)}`);
    }
  }

  // Secondary provider only for what the primary left empty.
  const missing = missingAfterPrimary(toFetch, primary, candidateName, confirmedDomain);
  let secondary = null;
  let secondaryFailed = false;
  if (missing.length) {
    const s = await pdlEnrichContact(url, missing, stored.pdl_id ?? null, fetch, anchors);
    if (s.ok) {
      secondary = s.contact;
      const fields = mergedFields(missing, mergeContacts(missing, null, secondary, candidateName, null, confirmedDomain));
      audit.step("secondary_lookup", fields.length ? "found" : "miss", { fields, httpStatus: 200 });
    } else {
      secondaryFailed = s.reason === "unavailable";
      audit.step("secondary_lookup", "unavailable", { detail: s.reason });
    }
  }
  if (secondary?.pdl_id) stored.pdl_id = secondary.pdl_id;
  const preMerged = mergeContacts(toFetch, primary, secondary, candidateName, null, confirmedDomain);

  // Tertiary provider only for what both primary and secondary left empty.
  const stillMissing = missingAfterMerged(toFetch, preMerged);
  let tertiary = null;
  let tertiaryFailed = false;
  if (stillMissing.length) {
    const t = await contactOutEnrichContact(url, stillMissing, fetch, anchors.companyDomain);
    if (t.ok) {
      tertiary = t.contact;
      const fields = mergedFields(stillMissing, mergeContacts(stillMissing, null, null, candidateName, tertiary, confirmedDomain));
      audit.step("tertiary_lookup", fields.length ? "found" : "miss", { fields, httpStatus: 200 });
    } else {
      tertiaryFailed = t.reason === "unavailable" || t.reason === "out_of_credits";
      audit.step("tertiary_lookup", "unavailable", { detail: t.reason });
    }
  }

  const merged = tertiary ? mergeContacts(toFetch, primary, secondary, candidateName, tertiary, confirmedDomain) : preMerged;
  const anyFound = Boolean(merged.work_email || merged.personal_email || merged.phones?.length);
  if (!res.ok && (secondaryFailed || !secondary) && (tertiaryFailed || !anyFound)) {
    const message = "Contact lookup is unavailable right now. Try again shortly.";
    return await respond(502, { ...summary(), error: message }, "error", message);
  }

  const now = new Date().toISOString();
  let lookupIncomplete = !res.ok || primaryIncomplete || secondaryFailed || tertiaryFailed;

  // Learn only from provider-verified work email tied to the current employer
  // and an exact known employer domain. Failures never block the contact result.
  const verifiedWorkEmail = merged.work_email && (
    (merged.sources.work_email === "primary" && primary?.business_email_verified === true && primary.business_email?.trim().toLowerCase() === merged.work_email) ||
    (merged.sources.work_email === "tertiary" && tertiary?.work_email_verified === true && tertiary.work_email?.trim().toLowerCase() === merged.work_email)
  );
  if (merged.work_email && verifiedWorkEmail) {
    try {
      await observeVerifiedWorkEmail(db, {
        linkedinUrl: url,
        fullName: candidateName,
        employer: anchors.company,
        employerDomain: anchors.companyDomain,
        title: anchors.title,
        workEmail: merged.work_email,
        verified: true,
      });
    } catch (e) {
      console.warn(`[enrich_contact] institution evidence was not saved: ${String(e).slice(0, 160)}`);
    }
  }

  // A work-only request may have missed an address stored by the source under
  // personal emails. One bounded identity lookup can recover it without an LLM.
  if (toFetch.includes("work_email") && !merged.work_email && confirmedDomain && !toFetch.includes("personal_email") && !(syncRes.ok === false && syncRes.insufficientCredits)) {
    const relabel = await syncContactEnrich([url], ["personal_emails"]);
    const owned = relabel.ok ? employerEmail(relabel.data[0]?.personal_emails ?? [], confirmedDomain, candidateName) : null;
    if (owned) merged.work_email = owned;
    audit.step("email_classification_lookup", owned ? "found" : relabel.ok ? "miss" : "unavailable", { fields: owned ? ["work_email"] : [] });
  }

  // Last resort after every sourced provider: dynamically resolve the employer,
  // obtain current same-cohort colleague evidence, then promote one unambiguous
  // pattern into the ordinary work-email result and normal found-contact charge.
  if (toFetch.includes("work_email") && !merged.work_email && !(syncRes.ok === false && syncRes.insufficientCredits)) {
    try {
      const research = await researchInstitutionWorkEmail(db, {
        linkedinUrl: url,
        fullName: candidateName,
        employer: anchors.company,
        employerDomain: anchors.companyDomain,
        title: anchors.title,
      });
      audit.record({
        employer_domain: research.audit.domain,
        research: research.audit,
      });
      audit.step(
        "institution_research",
        research.suggestion ? "found" : research.audit.outcome === "unavailable" ? "unavailable" : "miss",
        { fields: research.suggestion ? ["work_email"] : [], detail: research.audit.reason ?? research.audit.outcome },
      );
      if (research.suggestion) {
        merged.work_email = research.suggestion.email;
        stored.work_email_suggestion = null;
        stored.employer_domain = research.audit.domain;
      }
      if (research.audit.outcome === "unavailable") lookupIncomplete = true;
    } catch (e) {
      lookupIncomplete = true;
      audit.step("institution_research", "unavailable", { detail: String(e).slice(0, 160) });
      console.warn(`[enrich_contact] institution research unavailable: ${String(e).slice(0, 160)}`);
    }
  }

  const found = foundContactKinds(toFetch, merged);
  if (toFetch.includes("work_email")) stored.research_version = CONTACT_RESEARCH_VERSION;
  for (const k of toFetch) {
    const hasResult = (k === "work_email" && !!merged.work_email)
      || (k === "personal_email" && !!merged.personal_email)
      || (k === "phone" && !!merged.phones?.length);
    // A partial outage is not a 30-day verified miss.
    if (hasResult || !lookupIncomplete) checked[k] = now;
    else delete checked[k];
    if (k === "work_email" && merged.work_email) {
      stored.work_email = merged.work_email;
      stored.work_email_suggestion = null;
    }
    if (k === "personal_email" && merged.personal_email) stored.personal_emails = [merged.personal_email];
    if (k === "phone" && merged.phones?.length) stored.phone_numbers = merged.phones;
  }
  if (merged.profile_picture_url && !stored.profile_pic_url) stored.profile_pic_url = merged.profile_picture_url;
  audit.record({
    found,
    work_email: stored.work_email ?? null,
    profile_pic_url: stored.profile_pic_url ?? null,
    photo_backfilled: !!merged.profile_picture_url,
  });
  const sources = merged.sources;
  if (Object.keys(sources).length) console.log(`[enrich_contact] sources ${JSON.stringify(sources)}`);

  const charge = contactCharge(unlimited, found.map((k) => PRICES[k]));
  audit.record({ charged: charge });
  if (charge > 0) {
    const { data: newBal, error } = await db.rpc("charge_contact_credits", {
      _company_id: companyId, _user_id: caller.userId,
      _kinds: found.map((k) => ({ kind: k, cost: PRICES[k] })),
      _candidate_name: candidateName, _linkedin_url: url,
    });
    if (error) {
      const message = error.message.includes("monthly credit limit") ? "Your monthly credit limit has been reached. Ask your workspace admin to raise it." : "insufficient_credits";
      return await respond(402, { ...summary(), error: message, needed: charge }, "error", message);
    }
    balance = newBal as number;
  }

  const { error: saveError } = await db.from("contact_unlocks").upsert({
    company_id: companyId, linkedin_url: url, data: stored, checked, updated_at: now,
  });
  audit.record({ saved: !saveError });
  if (saveError) console.warn(`[enrich_contact] contact save failed: ${saveError.message.slice(0, 160)}`);

  return await respond(200, { ...summary(), charged: charge, found }, found.length ? "found" : "not_found");
}
