// Tertiary contact waterfall provider (ContactOut).
// Called only for fields left empty by the primary and secondary providers.
// Provider names and API tokens never leave the server.
import { safeProfileImageUrl, type WaterfallKind } from "./contact-waterfall.ts";

export interface TertiaryContact {
  work_email: string | null;
  work_email_verified: boolean;
  work_domain_ok: boolean;
  personal_emails: string[];
  phone_numbers: string[];
  identity_confirmed: boolean;
  profile_picture_url: string | null;
}

export type ContactOutLookup =
  | { ok: true; contact: TertiaryContact | null }
  | { ok: false; reason: "not_configured" | "out_of_credits" | "unavailable" };

const clean = (s: unknown) => (typeof s === "string" ? s.trim().toLowerCase() : "");
const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
const isPhone = (s: unknown): s is string => typeof s === "string" && !s.includes("@") && s.replace(/\D/g, "").length >= 10;
const domainOf = (s: string) => s.replace(/^https?:\/\//, "").replace(/^www\./, "").split(/[/?#]/)[0].toLowerCase();

/** Ensure the LinkedIn URL meets ContactOut's requirements (http(s) + /in/ or /pub/, never /sales/ or /talent/). */
export function normalizeContactOutProfileUrl(raw: string): string | null {
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    return null;
  }
  const host = parsed.hostname.toLowerCase();
  if (host !== "linkedin.com" && !host.endsWith(".linkedin.com")) return null;
  const path = parsed.pathname.toLowerCase();
  if (path.includes("/sales/") || path.includes("/talent/")) return null;
  if (!path.includes("/in/") && !path.includes("/pub/")) return null;
  return `https://www.linkedin.com${parsed.pathname.replace(/\/+$/, "")}`;
}

/** Build query params requesting only the exact missing fields so no extra credits are spent. */
export function contactOutQuery(linkedinUrl: string, missing: WaterfallKind[]): URLSearchParams | null {
  const profile = normalizeContactOutProfileUrl(linkedinUrl);
  if (!profile || !missing.length) return null;
  const needWork = missing.includes("work_email");
  const needPersonal = missing.includes("personal_email");
  const needPhone = missing.includes("phone");

  const q = new URLSearchParams({ profile });
  if (needPersonal && needWork) q.set("email_type", "personal,work");
  else if (needWork) q.set("email_type", "work");
  else if (needPersonal) q.set("email_type", "personal");
  else q.set("email_type", "none");

  if (needPhone) q.set("include_phone", "true");
  return q;
}

function domainMatches(email: string, employerDomain?: string | null): boolean {
  const sd = employerDomain ? domainOf(employerDomain) : "";
  if (!sd) return true;
  const wd = email.split("@")[1]?.toLowerCase() ?? "";
  return !!wd && (wd === sd || wd.endsWith("." + sd) || sd.endsWith("." + wd));
}

/** Normalize a ContactOut profile response into TertiaryContact. */
export function parseContactOutProfile(
  profile: Record<string, unknown>,
  employerDomain?: string | null,
): TertiaryContact {
  const arr = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
  const workEmails = arr(profile.work_email).map(clean).filter(isEmail);
  const personalEmails = arr(profile.personal_email).map(clean).filter(isEmail);
  const phones = [...new Set(arr(profile.phone).filter(isPhone))];

  const rawStatus = profile.work_email_status && typeof profile.work_email_status === "object"
    ? (profile.work_email_status as Record<string, unknown>)
    : {};
  const statusMap = new Map<string, string>();
  for (const [k, v] of Object.entries(rawStatus)) {
    if (typeof v === "string") statusMap.set(clean(k), v.trim().toLowerCase());
  }

  let workEmail: string | null = null;
  let workVerified = false;
  let workDomainOk = false;

  // Prefer a Verified work email matching the current employer domain.
  for (const e of workEmails) {
    const st = statusMap.get(e);
    if (st === "unverified") continue;
    const verified = st === "verified";
    const domOk = domainMatches(e, employerDomain);
    if (verified && domOk) {
      workEmail = e;
      workVerified = true;
      workDomainOk = true;
      break;
    }
    if (!workEmail && !st && employerDomain && domOk) {
      workEmail = e;
      workVerified = false;
      workDomainOk = true;
    }
  }

  return {
    work_email: workEmail,
    work_email_verified: workVerified,
    work_domain_ok: workDomainOk,
    personal_emails: personalEmails,
    phone_numbers: phones,
    identity_confirmed: true, // /v1/people/linkedin matches strictly on exact LinkedIn profile URL
    profile_picture_url: safeProfileImageUrl(profile.profile_picture_url ?? profile.profilePictureUrl),
  };
}

/** One ContactOut lookup by LinkedIn URL. 404 = no match (0 credits). */
export async function contactOutEnrichContact(
  linkedinUrl: string,
  missing: WaterfallKind[],
  fetcher: typeof fetch = fetch,
  employerDomain?: string | null,
): Promise<ContactOutLookup> {
  const token = Deno.env.get("CONTACTOUT_API_KEY");
  if (!token) return { ok: false, reason: "not_configured" };
  const q = contactOutQuery(linkedinUrl, missing);
  if (!q) return { ok: true, contact: null };

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetcher(`https://api.contactout.com/v1/people/linkedin?${q}`, {
        headers: {
          token,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(15_000),
      });
      if (res.status === 404) return { ok: true, contact: null };
      if (res.status === 403) {
        console.warn("[contact-waterfall] tertiary lookup quota or access error (403)");
        return { ok: false, reason: "out_of_credits" };
      }
      if (res.status === 429 && attempt < 2) {
        const retryAfter = Number(res.headers.get("retry-after"));
        const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
          ? Math.min(retryAfter * 1000, 5_000)
          : 2 ** attempt * 800;
        await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }
      if (!res.ok) {
        console.warn(`[contact-waterfall] tertiary lookup ${res.status}`);
        return { ok: false, reason: "unavailable" };
      }
      const body = await res.json() as { status_code?: number; profile?: unknown };
      if (body.status_code === 404 || !body.profile || Array.isArray(body.profile) || typeof body.profile !== "object") {
        return { ok: true, contact: null };
      }
      return { ok: true, contact: parseContactOutProfile(body.profile as Record<string, unknown>, employerDomain) };
    } catch (e) {
      if (attempt === 2) {
        console.warn("[contact-waterfall] tertiary lookup failed", String(e).slice(0, 200));
        return { ok: false, reason: "unavailable" };
      }
    }
  }
  return { ok: false, reason: "unavailable" };
}