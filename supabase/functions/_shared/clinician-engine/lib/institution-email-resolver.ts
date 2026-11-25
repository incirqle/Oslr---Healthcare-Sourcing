// Dynamic institutional work-email research. There is no institution directory:
// resolve the exact organization, then use a bounded set of current colleagues'
// verified work emails to establish both its mail domain and naming pattern.
import { ENRICHMENT_TTL_MS, getCrustDataCache, setCrustDataCache } from "../cache.ts";
import { companySearchV2, personSearchV2, syncContactEnrich, webSearchLiveV2 } from "./crustdata-v2.ts";
import { clinicalCohort, normalizeDomain, normalizeOrganization } from "./institution-email.ts";
import {
  observeVerifiedWorkEmail,
  suggestInstitutionWorkEmail,
  type WorkEmailSuggestion,
} from "./institution-email-store.ts";

interface Db { from: (table: string) => any }

export interface InstitutionResearchInput {
  linkedinUrl: string;
  fullName: string | null;
  employer: string | null;
  employerDomain?: string | null;
  title?: string | null;
}

export interface InstitutionResearchAudit {
  outcome: "reused" | "reconstructed" | "no_match" | "unavailable";
  domain: string | null;
  domainSource: "supplied" | "identified" | "official_site" | "cache" | null;
  profilesExamined: number;
  colleaguesSelected: number;
  evidenceSaved: number;
  reason?: string;
}

export interface InstitutionResearchResult {
  suggestion: WorkEmailSuggestion | null;
  audit: InstitutionResearchAudit;
}

interface CacheEntry { domain: string; resolvedName: string }
interface Deps {
  companySearch: (employer: string) => ReturnType<typeof companySearchV2>;
  webSearch: typeof webSearchLiveV2;
  resolveRedirect: (url: string) => Promise<string | null>;
  search: typeof personSearchV2;
  contacts: typeof syncContactEnrich;
  cacheGet: typeof getCrustDataCache;
  cacheSet: typeof setCrustDataCache;
}

const defaultDeps: Deps = {
  companySearch: (employer: string) => companySearchV2({
    filters: { field: "basic_info.name", type: "=", value: employer },
    fields: [
      "crustdata_company_id",
      "basic_info.name",
      "basic_info.primary_domain",
      "basic_info.all_domains",
      "basic_info.website",
      "locations.city",
      "locations.country",
    ],
    limit: 5,
  }),
  webSearch: webSearchLiveV2,
  resolveRedirect: async (url: string) => {
    try {
      const target = new URL(url);
      if (target.protocol !== "https:" || !["google.com", "www.google.com"].includes(target.hostname)) return null;
      const response = await fetch(target, { redirect: "manual", signal: AbortSignal.timeout(12000) });
      await response.body?.cancel();
      if (response.status < 300 || response.status >= 400) return null;
      const location = response.headers.get("location");
      return location ? new URL(location, target).toString() : null;
    } catch {
      return null;
    }
  },
  search: personSearchV2,
  contacts: syncContactEnrich,
  cacheGet: getCrustDataCache,
  cacheSet: setCrustDataCache,
};

const MAX_PROFILES = 8;
const MIN_COLLEAGUES = 3;
const MAX_CONTACT_CANDIDATES = 5;
const NON_ORGANIZATION_DOMAINS = new Set([
  "gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "aol.com", "icloud.com", "me.com",
  "msn.com", "live.com", "proton.me", "protonmail.com", "linktr.ee", "linkedin.com", "facebook.com",
  "instagram.com", "twitter.com", "x.com", "bit.ly", "beacons.ai", "carrd.co", "google.com", "www.google.com",
]);
const cleanUrl = (value: unknown) => typeof value === "string"
  ? value.trim().toLowerCase().replace(/\/+$/, "")
  : "";

function organizationDomain(value: unknown): string | null {
  const domain = normalizeDomain(value);
  if (!domain || NON_ORGANIZATION_DOMAINS.has(domain)) return null;
  const tld = domain.split(".").at(-1) ?? "";
  return /^[a-z]{2,}$/.test(tld) ? domain : null;
}

function profileUrl(profile: Record<string, unknown>): string | null {
  const social = profile.social_handles as Record<string, unknown> | undefined;
  const professional = social?.professional_network_identifier as Record<string, unknown> | undefined;
  const network = profile.professional_network as Record<string, unknown> | undefined;
  const basic = profile.basic_profile as Record<string, unknown> | undefined;
  const value = professional?.profile_url ?? network?.profile_url ?? basic?.profile_url ?? profile.linkedin_profile_url;
  if (typeof value !== "string") return null;
  const url = cleanUrl(value);
  return url.startsWith("https://www.linkedin.com/in/") || url.startsWith("https://linkedin.com/in/") ? url : null;
}

function currentRoles(profile: Record<string, unknown>): Record<string, unknown>[] {
  const experience = profile.experience as Record<string, unknown> | undefined;
  const employment = experience?.employment_details as Record<string, unknown> | undefined;
  return Array.isArray(employment?.current)
    ? (employment!.current as unknown[]).filter((r): r is Record<string, unknown> => !!r && typeof r === "object")
    : [];
}

function exactEmployerRole(profile: Record<string, unknown>, organization: string): Record<string, unknown> | null {
  return currentRoles(profile).find((role) =>
    normalizeOrganization(role.company_name ?? role.name ?? role.company) === organization
  ) ?? null;
}

function personName(profile: Record<string, unknown>): string | null {
  const basic = profile.basic_profile as Record<string, unknown> | undefined;
  return typeof basic?.name === "string" && basic.name.trim() ? basic.name.trim() : null;
}

function emptyAudit(): InstitutionResearchAudit {
  return {
    outcome: "no_match",
    domain: null,
    domainSource: null,
    profilesExamined: 0,
    colleaguesSelected: 0,
    evidenceSaved: 0,
  };
}

async function officialWebsiteDomain(employer: string, deps: Deps): Promise<string | null | undefined> {
  const search = await deps.webSearch(`${employer} official website`);
  if (!search.ok) return undefined;
  const organization = normalizeOrganization(employer)!;
  const first = (search.data.results ?? [])[0];
  if (!first || !normalizeOrganization(first.title)?.includes(organization) || typeof first.url !== "string") return null;
  let url = first.url;
  try {
    const host = new URL(url).hostname;
    if (["google.com", "www.google.com"].includes(host)) {
      url = await deps.resolveRedirect(url) ?? "";
    }
    return url ? organizationDomain(new URL(url).hostname) : null;
  } catch {
    return null;
  }
}

async function resolveDomain(
  employer: string,
  supplied: string | null,
  deps: Deps,
): Promise<{
  domain: string | null;
  source: InstitutionResearchAudit["domainSource"];
  unambiguous: boolean;
  unavailable?: boolean;
}> {
  if (supplied) return { domain: supplied, source: "supplied", unambiguous: true };
  const organization = normalizeOrganization(employer)!;
  const cacheKey = `contact:employer-domain:v3:${organization}`;
  const cached = await deps.cacheGet(cacheKey, ENRICHMENT_TTL_MS);
  const entry = cached?.profiles?.[0] as unknown as CacheEntry | undefined;
  const cachedDomain = organizationDomain(entry?.domain);
  if (cachedDomain) return { domain: cachedDomain, source: "cache", unambiguous: true };

  const found = await deps.companySearch(employer);
  if (!found.ok) return { domain: null, source: null, unambiguous: false, unavailable: true };
  const exact = found.data.filter((row) =>
    normalizeOrganization(row.basic_info?.name ?? row.name) === organization
  );
  if (exact.length !== 1) return { domain: null, source: null, unambiguous: false };
  const info = exact[0].basic_info ?? {};
  let domain = organizationDomain(info.primary_domain);
  if (!domain) {
    const domains = Array.isArray(info.all_domains)
      ? [...new Set(info.all_domains.map(organizationDomain).filter((d): d is string => !!d))]
      : [];
    if (domains.length === 1) domain = domains[0];
  }
  if (!domain) domain = organizationDomain(info.website);
  let source: InstitutionResearchAudit["domainSource"] = "identified";
  if (!domain) {
    const official = await officialWebsiteDomain(employer, deps);
    if (official === undefined) return { domain: null, source: null, unambiguous: false, unavailable: true };
    domain = official;
    source = "official_site";
  }
  if (!domain) return { domain: null, source, unambiguous: true };
  const resolvedName = typeof info.name === "string" ? info.name : employer;
  if (source === "identified") await deps.cacheSet(cacheKey, 1, [{ domain, resolvedName }], null);
  return { domain, source, unambiguous: true };
}

function cohortTitleFilter(cohort: string): Record<string, unknown> | null {
  const terms = cohort === "graduate_medical_trainee"
    ? ["resident", "residency", "fellow", "fellowship", "intern", "pgy", "house officer"]
    : cohort === "nursing_student"
    ? ["nursing student", "student nurse"]
    : null;
  return terms
    ? {
      op: "or",
      conditions: terms.map((value) => ({ field: "experience.employment_details.current.title", type: "[.]", value })),
    }
    : null;
}

/** Reuse learned evidence first; otherwise make one current company search,
 * one eight-profile colleague search, and one work-email-only contact request
 * for at most five people. Three independent current examples are required. */
export async function researchInstitutionWorkEmail(
  db: Db,
  input: InstitutionResearchInput,
  overrides: Partial<Deps> = {},
): Promise<InstitutionResearchResult> {
  const deps = { ...defaultDeps, ...overrides };
  const audit = emptyAudit();
  const organization = normalizeOrganization(input.employer);
  if (!organization || !input.fullName || !input.linkedinUrl) {
    audit.reason = "missing_identity_or_employer";
    return { suggestion: null, audit };
  }

  const resolved = await resolveDomain(input.employer!, organizationDomain(input.employerDomain), deps);
  audit.domain = resolved.domain;
  audit.domainSource = resolved.source;
  if (!resolved.unambiguous) {
    audit.outcome = resolved.unavailable ? "unavailable" : "no_match";
    audit.reason = resolved.unavailable ? "employer_resolution_unavailable" : "employer_not_unambiguous";
    return { suggestion: null, audit };
  }

  if (!resolved.domain) {
    audit.reason = "employer_domain_not_unambiguous";
    return { suggestion: null, audit };
  }

  if (resolved.domain) {
    const cached = await suggestInstitutionWorkEmail(db, { ...input, employerDomain: resolved.domain });
    if (cached) {
      audit.outcome = "reused";
      audit.domain = cached.domain;
      return { suggestion: cached, audit };
    }
  }

  const titleFilter = cohortTitleFilter(clinicalCohort(input.title));
  const conditions: Record<string, unknown>[] = [
    { field: "experience.employment_details.current.company_name", type: "=", value: input.employer },
  ];
  if (titleFilter) conditions.push(titleFilter);
  const targetUrl = cleanUrl(input.linkedinUrl);
  const cohort = clinicalCohort(input.title);
  const colleagues: Array<{ url: string; name: string; title: string }> = [];
  const seen = new Set<string>([targetUrl]);
  const addProfiles = (profiles: Record<string, unknown>[]) => {
    for (const profile of profiles) {
      const url = profileUrl(profile);
      const name = personName(profile);
      const role = exactEmployerRole(profile, organization);
      if (!url || seen.has(cleanUrl(url)) || !name || !role || typeof role.title !== "string" || !role.title.trim()) continue;
      if (clinicalCohort(role.title) !== cohort) continue;
      seen.add(cleanUrl(url));
      colleagues.push({ url, name, title: role.title });
      if (colleagues.length === MAX_CONTACT_CANDIDATES) break;
    }
  };
  const searchOnce = (requireVerified: boolean) => deps.search({
    filters: {
      op: "and",
      conditions: [
        ...conditions,
        ...(requireVerified
          ? [{ field: "experience.employment_details.current.business_email_verified", type: "=", value: true }]
          : []),
      ],
    },
    fields: ["crustdata_person_id", "basic_profile", "experience", "professional_network", "social_handles"],
    limit: MAX_PROFILES,
  });
  const flagged = await searchOnce(true);
  if (!flagged.ok) {
    audit.outcome = "unavailable";
    audit.reason = "colleague_search_unavailable";
    return { suggestion: null, audit };
  }
  audit.profilesExamined += flagged.data.profiles.length;
  addProfiles(flagged.data.profiles);
  if (colleagues.length < MIN_COLLEAGUES) {
    const broader = await searchOnce(false);
    if (!broader.ok) {
      audit.outcome = "unavailable";
      audit.reason = "colleague_search_unavailable";
      return { suggestion: null, audit };
    }
    audit.profilesExamined += broader.data.profiles.length;
    addProfiles(broader.data.profiles);
  }
  audit.colleaguesSelected = colleagues.length;
  if (colleagues.length < MIN_COLLEAGUES) {
    audit.reason = "fewer_than_three_current_same_cohort_colleagues";
    return { suggestion: null, audit };
  }

  const contacts = await deps.contacts(colleagues.map((c) => c.url), ["business_email"]);
  if (!contacts.ok) {
    audit.outcome = "unavailable";
    audit.reason = "colleague_contacts_unavailable";
    return { suggestion: null, audit };
  }
  const byUrl = new Map(contacts.data.map((c) => [cleanUrl(c.linkedin_url), c]));
  const verified = colleagues.flatMap((colleague) => {
    const contact = byUrl.get(cleanUrl(colleague.url));
    const domain = contact?.business_email_verified ? organizationDomain(contact.business_email?.split("@")[1]) : null;
    return contact?.business_email && domain === resolved.domain ? [{ colleague, email: contact.business_email }] : [];
  });

  for (const row of verified) {
    try {
      await observeVerifiedWorkEmail(db, {
        linkedinUrl: row.colleague.url,
        fullName: row.colleague.name,
        employer: input.employer,
        employerDomain: resolved.domain,
        title: row.colleague.title,
        workEmail: row.email,
        verified: true,
      });
      audit.evidenceSaved++;
    } catch (error) {
      console.warn(`[institution-email] colleague evidence was not saved: ${String(error).slice(0, 160)}`);
    }
  }

  if (resolved.source === "official_site" && audit.evidenceSaved >= MIN_COLLEAGUES) {
    await deps.cacheSet(`contact:employer-domain:v3:${organization}`, 1, [{ domain: resolved.domain, resolvedName: input.employer }], null);
  }
  const suggestion = await suggestInstitutionWorkEmail(db, { ...input, employerDomain: resolved.domain });
  if (!suggestion) {
    audit.reason = audit.evidenceSaved < MIN_COLLEAGUES
      ? "insufficient_verified_exact_domain_evidence"
      : "no_single_unambiguous_pattern_or_address_collision";
    return { suggestion: null, audit };
  }
  audit.outcome = "reconstructed";
  return { suggestion, audit };
}
