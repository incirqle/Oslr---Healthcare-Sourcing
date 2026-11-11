// Contact waterfall: the primary provider (CrustData) answers first; the
// secondary provider (People Data Labs) is asked only for what is still missing.
// Provider names never leave the server.
import type { BatchEnrichResult } from "./crustdata-v2.ts";

export type WaterfallKind = "work_email" | "personal_email" | "phone";

export interface SecondaryContact {
  pdl_id: string | null;
  work_email: string | null;
  work_domain_ok: boolean; // work email domain matches the current employer website
  recommended_personal_email: string | null;
  personal_emails: string[];
  mobile_phone: string | null;
  phone_numbers: string[];
}

export interface MergedContact {
  work_email?: string;
  personal_email?: string; // the single best personal address
  phones?: string[];
  sources: Partial<Record<WaterfallKind, "primary" | "secondary">>;
}

const clean = (s: unknown) => (typeof s === "string" ? s.trim().toLowerCase() : "");
const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
const isPhone = (s: unknown): s is string => typeof s === "string" && !s.includes("@") && s.replace(/\D/g, "").length >= 10;

/** Which kinds the primary result left empty. */
export function missingAfterPrimary(kinds: WaterfallKind[], p: BatchEnrichResult | null | undefined): WaterfallKind[] {
  return kinds.filter((k) => {
    if (k === "work_email") return !(p?.business_email && isEmail(clean(p.business_email)));
    if (k === "personal_email") return !(p?.personal_emails ?? []).some((e) => isEmail(clean(e)));
    return ![p?.mobile_phone, ...(p?.phones ?? [])].some(isPhone);
  });
}

/** Combine the instant lookup with the batch retry: the instant answer wins
 *  per field, the batch only fills fields the instant lookup left empty. */
export function combinePrimary(
  sync: BatchEnrichResult | null | undefined,
  batch: BatchEnrichResult | null | undefined,
): BatchEnrichResult | null {
  if (!sync) return batch ?? null;
  if (!batch) return sync;
  const be = sync.business_email && isEmail(clean(sync.business_email));
  const personal = sync.personal_emails.length ? sync.personal_emails : batch.personal_emails;
  const phones = sync.phones.length ? sync.phones : batch.phones;
  const mobile = sync.mobile_phone ?? (sync.phones.length ? null : batch.mobile_phone);
  return {
    ...sync,
    business_email: be ? sync.business_email : batch.business_email,
    business_email_verified: be ? sync.business_email_verified : batch.business_email_verified,
    personal_emails: personal,
    phones,
    mobile_phone: mobile,
    has_contact: !!((be ? sync.business_email : batch.business_email) || personal.length || mobile || phones.length),
  };
}

/**
 * Merge rules (agreed with the founder from weekly side-by-side tests):
 * - Work email: primary always wins (fresher employer data). Secondary only
 *   fills an empty slot, and only when its domain matches the current employer.
 * - Personal email: primary if present, else secondary's recommended address
 *   (its deliverability pick), else its first personal address. One address only.
 * - Phone: primary if present, else secondary mobile first, then other numbers.
 */
export function mergeContacts(
  kinds: WaterfallKind[],
  primary: BatchEnrichResult | null | undefined,
  secondary: SecondaryContact | null | undefined,
): MergedContact {
  const out: MergedContact = { sources: {} };
  for (const k of kinds) {
    if (k === "work_email") {
      const p = clean(primary?.business_email);
      const s = clean(secondary?.work_email);
      if (isEmail(p)) { out.work_email = p; out.sources.work_email = "primary"; }
      else if (isEmail(s) && secondary?.work_domain_ok) { out.work_email = s; out.sources.work_email = "secondary"; }
    }
    if (k === "personal_email") {
      const p = (primary?.personal_emails ?? []).map(clean).find(isEmail);
      const s = [secondary?.recommended_personal_email, ...(secondary?.personal_emails ?? [])].map(clean).find(isEmail);
      if (p) { out.personal_email = p; out.sources.personal_email = "primary"; }
      else if (s) { out.personal_email = s; out.sources.personal_email = "secondary"; }
    }
    if (k === "phone") {
      const p = [...new Set([primary?.mobile_phone, ...(primary?.phones ?? [])].filter(isPhone))];
      const s = [...new Set([secondary?.mobile_phone, ...(secondary?.phone_numbers ?? [])].filter(isPhone))];
      if (p.length) { out.phones = p.slice(0, 3); out.sources.phone = "primary"; }
      else if (s.length) { out.phones = s.slice(0, 3); out.sources.phone = "secondary"; }
    }
  }
  return out;
}

const domainOf = (s: string) => s.replace(/^https?:\/\//, "").replace(/^www\./, "").split(/[/?#]/)[0].toLowerCase();

/** Normalize a People Data Labs person record into SecondaryContact. */
export function parsePdlPerson(d: Record<string, unknown>): SecondaryContact {
  const str = (v: unknown) => (typeof v === "string" && v ? v : null);
  const arr = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
  const work = str(d.work_email);
  const site = str(d.job_company_website);
  const wd = work ? work.split("@")[1]?.toLowerCase() ?? "" : "";
  const sd = site ? domainOf(site) : "";
  const domainOk = !!work && (!sd || wd === sd || wd.endsWith("." + sd) || sd.endsWith("." + wd));
  return {
    pdl_id: str(d.id),
    work_email: work,
    work_domain_ok: domainOk,
    recommended_personal_email: str(d.recommended_personal_email),
    personal_emails: arr(d.personal_emails),
    mobile_phone: str(d.mobile_phone),
    phone_numbers: arr(d.phone_numbers),
  };
}

const PDL_REQUIRED: Record<WaterfallKind, string> = {
  work_email: "work_email",
  personal_email: "personal_emails",
  phone: "mobile_phone OR phone_numbers",
};

/** Build the `required` filter so a profile without the missing data is not billed. */
export function pdlRequired(missing: WaterfallKind[]): string {
  return missing.map((k) => (missing.length > 1 && k === "phone" ? `(${PDL_REQUIRED[k]})` : PDL_REQUIRED[k])).join(" OR ");
}

export type PdlLookup =
  | { ok: true; contact: SecondaryContact | null }
  | { ok: false; reason: "not_configured" | "unavailable" };

/** One People Data Labs enrich by LinkedIn URL (or a known PDL id). 404 = no match, not billed. */
export async function pdlEnrichContact(
  linkedinUrl: string,
  missing: WaterfallKind[],
  pdlId?: string | null,
  fetcher: typeof fetch = fetch,
): Promise<PdlLookup> {
  const key = Deno.env.get("PDL_API_KEY");
  if (!key) return { ok: false, reason: "not_configured" };
  if (!missing.length) return { ok: true, contact: null };
  const q = new URLSearchParams({ min_likelihood: "6", titlecase: "false", required: pdlRequired(missing) });
  if (pdlId) q.set("pdl_id", pdlId);
  else q.set("profile", linkedinUrl);
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetcher(`https://api.peopledatalabs.com/v5/person/enrich?${q}`, {
        headers: { "X-Api-Key": key, Accept: "application/json" },
        signal: AbortSignal.timeout(10_000),
      });
      if (res.status === 404) return { ok: true, contact: null };
      if (res.status === 429 && attempt < 2) { await new Promise((r) => setTimeout(r, 2 ** attempt * 800)); continue; }
      if (!res.ok) {
        console.warn(`[contact-waterfall] secondary lookup ${res.status}`);
        return { ok: false, reason: "unavailable" };
      }
      const body = await res.json() as { data?: Record<string, unknown> };
      return { ok: true, contact: body.data ? parsePdlPerson(body.data) : null };
    } catch (e) {
      if (attempt === 2) { console.warn("[contact-waterfall] secondary lookup failed", String(e).slice(0, 200)); return { ok: false, reason: "unavailable" }; }
    }
  }
  return { ok: false, reason: "unavailable" };
}
