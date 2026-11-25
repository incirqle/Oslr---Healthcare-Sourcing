// Contact waterfall: primary (CrustData) answers first; secondary (People Data
// Labs) is asked for what is missing; tertiary (ContactOut) fills any remaining gaps.
// Provider names never leave the server.
import type { BatchEnrichResult } from "./crustdata-v2.ts";
import type { TertiaryContact } from "./contactout.ts";
import { employerEmail } from "./email-classification.ts";

export type WaterfallKind = "work_email" | "personal_email" | "phone";

export interface SecondaryContact {
  pdl_id: string | null;
  work_email: string | null;
  work_domain_ok: boolean; // work email domain matches the current employer website
  recommended_personal_email: string | null;
  personal_emails: string[];
  mobile_phone: string | null;
  phone_numbers: string[];
  /** True when the record was matched on the person's LinkedIn profile or a stored id
   *  (include_if_matched), so its addresses are confirmed to belong to them. */
  identity_confirmed: boolean;
  profile_picture_url: string | null;
}

export interface MergedContact {
  work_email?: string;
  personal_email?: string; // the single best personal address
  phones?: string[];
  profile_picture_url?: string;
  sources: Partial<Record<WaterfallKind, "primary" | "secondary" | "tertiary">>;
}

const clean = (s: unknown) => (typeof s === "string" ? s.trim().toLowerCase() : "");
const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
const isPhone = (s: unknown): s is string => typeof s === "string" && !s.includes("@") && s.replace(/\D/g, "").length >= 10;

/** Which kinds the primary result left empty. */
export function missingAfterPrimary(kinds: WaterfallKind[], p: BatchEnrichResult | null | undefined, fullName?: string | null, employerDomain?: string | null): WaterfallKind[] {
  const corporate = employerEmail(p?.personal_emails ?? [], employerDomain, fullName);
  return kinds.filter((k) => {
    if (k === "work_email") return !corporate && !(p?.business_email_verified === true && p.business_email && isEmail(clean(p.business_email)));
    if (k === "personal_email") return !(p?.personal_emails ?? []).some((e) => clean(e) !== corporate && isEmail(clean(e)) && emailMatchesName(clean(e), fullName));
    return ![p?.mobile_phone, ...(p?.phones ?? [])].some(isPhone);
  });
}

/** Which requested kinds are still empty in a merged contact result. */
export function missingAfterMerged(kinds: WaterfallKind[], m: MergedContact): WaterfallKind[] {
  return kinds.filter((k) => {
    if (k === "work_email") return !m.work_email;
    if (k === "personal_email") return !m.personal_email;
    return !(m.phones && m.phones.length > 0);
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
  const be = sync.business_email_verified === true && sync.business_email && isEmail(clean(sync.business_email));
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
/**
 * True when an email's local part carries part of the person's name
 * (first name, last name, or first initial + last name). Used to prefer the
 * address that is actually theirs over one that belongs to someone else.
 */
export function emailMatchesName(email: string, fullName: string | null | undefined): boolean {
  if (!fullName) return true;
  const local = email.split("@")[0].toLowerCase().replace(/[^a-z]/g, "");
  const parts = fullName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/,.*$/, "").split(/[\s-]+/).map((t) => t.replace(/[^a-z]/g, ""))
    .filter((t) => t && !["dr", "md", "do", "dpm", "jr", "sr", "ii", "iii"].includes(t));
  if (!parts.length || !local) return true;
  const first = parts[0];
  const last = parts[parts.length - 1];
  if (parts.some((t) => t.length >= 3 && local.includes(t))) return true;
  return local.includes(first[0] + last) || local.includes(last + first[0]);
}

export function mergeContacts(
  kinds: WaterfallKind[],
  primary: BatchEnrichResult | null | undefined,
  secondary: SecondaryContact | null | undefined,
  fullName?: string | null,
  tertiary?: TertiaryContact | null,
  employerDomain?: string | null,
): MergedContact {
  const out: MergedContact = { sources: {} };
  const corporate = [
    [employerEmail(primary?.personal_emails ?? [], employerDomain, fullName), "primary"],
    [employerEmail(secondary?.personal_emails ?? [], employerDomain, fullName), "secondary"],
    [employerEmail(tertiary?.personal_emails ?? [], employerDomain, fullName), "tertiary"],
  ] as const;
  for (const k of kinds) {
    if (k === "work_email") {
      const p = clean(primary?.business_email);
      const s = clean(secondary?.work_email);
      const t = clean(tertiary?.work_email);
      if (primary?.business_email_verified === true && isEmail(p)) { out.work_email = p; out.sources.work_email = "primary"; }
      else if (isEmail(s) && secondary?.work_domain_ok) { out.work_email = s; out.sources.work_email = "secondary"; }
      else if (isEmail(t) && tertiary?.work_domain_ok && (tertiary.work_email_verified || emailMatchesName(t, fullName))) {
        out.work_email = t;
        out.sources.work_email = "tertiary";
      }
      if (!out.work_email) {
        const hit = corporate.find(([email]) => email);
        if (hit?.[0]) { out.work_email = hit[0]; out.sources.work_email = hit[1]; }
      }
    }
    if (k === "personal_email") {
      // "If true" rule: an address is kept only when something confirms it is theirs.
      // Primary: the address carries their name. Secondary: carries their name, or
      // the record was matched on their own LinkedIn profile / stored id (then its
      // recommended address first). Tertiary: matched strictly on their LinkedIn URL
      // (prefers name match first, else first valid personal email).
      const personal = (emails: Array<string | null | undefined>) => emails.map(clean).filter(isEmail).filter(e => !corporate.some(([c]) => c === e));
      const pList = personal(primary?.personal_emails ?? []);
      const sList = personal([secondary?.recommended_personal_email, ...(secondary?.personal_emails ?? [])]);
      const tList = personal(tertiary?.personal_emails ?? []);
      const named = (l: string[]) => l.find((e) => emailMatchesName(e, fullName));
      const pick: [string | undefined, "primary" | "secondary" | "tertiary"][] = [
        [named(pList), "primary"], [named(sList), "secondary"],
        [secondary?.identity_confirmed ? sList[0] : undefined, "secondary"],
        [named(tList), "tertiary"],
        [tertiary?.identity_confirmed ? tList[0] : undefined, "tertiary"],
      ];
      const hit = pick.find(([e]) => e);
      if (hit) { out.personal_email = hit[0]; out.sources.personal_email = hit[1]; }
    }
    if (k === "phone") {
      const p = [...new Set([primary?.mobile_phone, ...(primary?.phones ?? [])].filter(isPhone))];
      const s = [...new Set([secondary?.mobile_phone, ...(secondary?.phone_numbers ?? [])].filter(isPhone))];
      const t = [...new Set((tertiary?.phone_numbers ?? []).filter(isPhone))];
      if (p.length) { out.phones = p.slice(0, 3); out.sources.phone = "primary"; }
      else if (s.length) { out.phones = s.slice(0, 3); out.sources.phone = "secondary"; }
      else if (t.length) { out.phones = t.slice(0, 3); out.sources.phone = "tertiary"; }
    }
  }
  const photo = tertiary?.profile_picture_url || secondary?.profile_picture_url;
  if (photo) out.profile_picture_url = photo;
  return out;
}

export function safeProfileImageUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2048) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

const domainOf = (s: string) => s.replace(/^https?:\/\//, "").replace(/^www\./, "").split(/[/?#]/)[0].toLowerCase();

/** Normalize a People Data Labs person record into SecondaryContact. */
export function parsePdlPerson(d: Record<string, unknown>, matched: string[] = []): SecondaryContact {
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
    identity_confirmed: matched.some((m) => m === "profile" || m === "pdl_id" || m === "lid"),
    profile_picture_url: safeProfileImageUrl(d.profile_picture_url ?? d.profile_pic_url ?? d.picture_url ?? d.photo_url),
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

export interface PdlAnchors { name?: string | null; company?: string | null; location?: string | null }

/** Build the enrich query: a stored id is exact; otherwise the LinkedIn profile plus
 *  name/employer/location anchors, a likelihood floor and the matched-on report. */
export function pdlQuery(linkedinUrl: string, missing: WaterfallKind[], pdlId?: string | null, anchors: PdlAnchors = {}): URLSearchParams {
  const q = new URLSearchParams({
    min_likelihood: "6", titlecase: "false", include_if_matched: "true", required: pdlRequired(missing),
  });
  if (pdlId) { q.set("pdl_id", pdlId); return q; }
  q.set("profile", linkedinUrl);
  const name = anchors.name?.replace(/,.*$/, "").replace(/\b(dr|md|do|dpm)\.?\b/gi, "").replace(/\s+/g, " ").trim();
  if (name) q.set("name", name);
  if (anchors.company?.trim()) q.set("company", anchors.company.trim());
  if (anchors.location?.trim()) q.set("location", anchors.location.trim());
  return q;
}

/** One People Data Labs enrich by LinkedIn URL (or a known PDL id). 404 = no match, not billed. */
export async function pdlEnrichContact(
  linkedinUrl: string,
  missing: WaterfallKind[],
  pdlId?: string | null,
  fetcher: typeof fetch = fetch,
  anchors: PdlAnchors = {},
): Promise<PdlLookup> {
  const key = Deno.env.get("PDL_API_KEY");
  if (!key) return { ok: false, reason: "not_configured" };
  if (!missing.length) return { ok: true, contact: null };
  const q = pdlQuery(linkedinUrl, missing, pdlId, anchors);
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
      const body = await res.json() as { data?: Record<string, unknown>; matched?: unknown };
      const matched = Array.isArray(body.matched) ? body.matched.filter((m): m is string => typeof m === "string") : [];
      if (pdlId) matched.push("pdl_id");
      return { ok: true, contact: body.data ? parsePdlPerson(body.data, matched) : null };
    } catch (e) {
      if (attempt === 2) { console.warn("[contact-waterfall] secondary lookup failed", String(e).slice(0, 200)); return { ok: false, reason: "unavailable" }; }
    }
  }
  return { ok: false, reason: "unavailable" };
}
