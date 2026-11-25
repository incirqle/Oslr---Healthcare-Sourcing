// Dynamic institutional work-email research. There is no institution directory.
// The coworkers are the source of truth: pull current staff at the exact
// employer, read the work addresses providers hold for them, and let those
// addresses elect the mail domain and naming pattern. A company's listed
// website (often a link page or a careers site) is only a hint, never a gate.
import { ENRICHMENT_TTL_MS, getCrustDataCache, setCrustDataCache } from "../cache.ts";
import { companySearchV2, personSearchAutocomplete, personSearchV2, syncContactEnrich } from "./crustdata-v2.ts";
import { canonicalLinkedinUrl, clinicalCohort, institutionalEmailCandidate, normalizeOrganization, type EmailPattern } from "./institution-email.ts";
import { addressBelongsToSomeoneElse, observeVerifiedWorkEmail, type WorkEmailSuggestion } from "./institution-email-store.ts";
import { electInstitutionEmail, isInstitutionCandidateDomain, type CoworkerEmail } from "./institution-election.ts";
import type { EmailReasoningInput, EmailReasoningResult } from "./institution-reasoning.ts";

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
  domainSource: "supplied" | "identified" | "colleagues" | "cache" | null;
  profilesExamined: number;
  colleaguesSelected: number;
  evidenceSaved: number;
  reason?: string;
  rejections?: Record<string, number>;
  domainSupport?: Record<string, number>;
  pattern?: string | null;
  supporters?: number;
  model?: { id: string; elapsedMs: number; requestId?: string; outcome: string };
}

export interface InstitutionResearchResult {
  suggestion: WorkEmailSuggestion | null;
  audit: InstitutionResearchAudit;
}

interface Deps {
  companySearch: (employer: string) => ReturnType<typeof companySearchV2>;
  search: typeof personSearchV2;
  autocomplete: typeof personSearchAutocomplete;
  /** Second-opinion review; may only veto, never invent. */
  reason: (input: EmailReasoningInput) => Promise<EmailReasoningResult>;
  contacts: typeof syncContactEnrich;
  cacheGet: typeof getCrustDataCache;
  cacheSet: typeof setCrustDataCache;
}

const defaultDeps: Deps = {
  companySearch: (employer: string) => companySearchV2({
    filters: { field: "basic_info.name", type: "=", value: employer },
    fields: ["crustdata_company_id", "basic_info.name", "basic_info.primary_domain", "basic_info.all_domains", "basic_info.website"],
    limit: 5,
  }),
  search: personSearchV2,
  autocomplete: personSearchAutocomplete,
  reason: async (input) => (await import("./institution-email-model.ts")).reviewInstitutionEmail(input),
  contacts: syncContactEnrich,
  cacheGet: getCrustDataCache,
  cacheSet: setCrustDataCache,
};

const FLAGGED_SEARCH_LIMIT = 12;
const BROAD_SEARCH_LIMIT = 40;
// A clean hospital should not pay for fifty coworkers. Six gives the election
// enough evidence to apply its full agreement checks; unclear cases escalate.
const INITIAL_CONTACT_SAMPLE = 6;
const CONTACT_BATCH = 25;
const MAX_CONTACT_PROFILES = 50;
const MAX_NAME_VARIANTS = 6;
const MISS_TTL_MS = 6 * 60 * 60 * 1000;
const RULE_VERSION = "v5";
/** No new coworker batch starts after this, keeping the whole lookup inside the request window. */
const RESEARCH_BUDGET_MS = 45_000;

const ruleKey = (companyKey: string) => `contact:institution-rule:${RULE_VERSION}:${companyKey}`;
const domainKey = (companyKey: string) => `contact:employer-domain:${RULE_VERSION}:${companyKey}`;
const missKey = (companyKey: string) => `contact:institution-miss:${RULE_VERSION}:${companyKey}`;

interface CachedRule { domain: string; pattern: EmailPattern; supporters: number; resolvedName: string }

// Accept an explicit trailing acronym, not a different affiliate or parent.
export function sameInstitution(a: unknown, b: unknown): boolean {
  const canonical = (v: unknown) => normalizeOrganization(typeof v === "string" ? v.replace(/\s*\([A-Z.]{2,12}\)\s*$/, "") : v);
  const left = canonical(a); const right = canonical(b);
  return !!left && left === right;
}

/** Indexed sub-units of the same employer ("Maimonides Medical Center - MMC Radiology FPP"). */
export function isEmployerSubunit(candidate: unknown, employer: unknown): boolean {
  const c = normalizeOrganization(candidate); const e = normalizeOrganization(employer);
  return !!c && !!e && (c === e || c.startsWith(`${e} `));
}

function profileUrl(profile: Record<string, unknown>): string | null {
  const social = profile.social_handles as Record<string, unknown> | undefined;
  const professional = social?.professional_network_identifier as Record<string, unknown> | undefined;
  const network = profile.professional_network as Record<string, unknown> | undefined;
  const basic = profile.basic_profile as Record<string, unknown> | undefined;
  return canonicalLinkedinUrl(professional?.profile_url ?? network?.profile_url ?? basic?.profile_url ?? profile.linkedin_profile_url);
}

function currentRoles(profile: Record<string, unknown>): Record<string, unknown>[] {
  const experience = profile.experience as Record<string, unknown> | undefined;
  const employment = experience?.employment_details as Record<string, unknown> | undefined;
  return Array.isArray(employment?.current)
    ? (employment.current as unknown[]).filter((r): r is Record<string, unknown> => !!r && typeof r === "object")
    : [];
}

function personName(profile: Record<string, unknown>): string | null {
  const basic = profile.basic_profile as Record<string, unknown> | undefined;
  return typeof basic?.name === "string" && basic.name.trim() ? basic.name.trim() : null;
}

/** The coworker's current role at the target, matched by company id when known. */
function employerRole(profile: Record<string, unknown>, employer: string, companyId: number | null) {
  const roles = currentRoles(profile);
  const index = roles.findIndex((role) => {
    if (companyId !== null && typeof role.crustdata_company_id === "number") return role.crustdata_company_id === companyId;
    return isEmployerSubunit(role.company_name ?? role.name ?? role.company, employer);
  });
  if (index < 0) return null;
  const role = roles[index];
  const primary = roles.length === 1 || role.is_default === true;
  const basic = profile.basic_profile as Record<string, unknown> | undefined;
  const title = typeof role.title === "string" && role.title.trim() ? role.title
    : typeof basic?.current_title === "string" ? basic.current_title : "";
  return { title, primary };
}

function emptyAudit(): InstitutionResearchAudit {
  return { outcome: "no_match", domain: null, domainSource: null, profilesExamined: 0, colleaguesSelected: 0, evidenceSaved: 0 };
}

export interface ResolvedEmployer {
  domain: string | null;
  source: InstitutionResearchAudit["domainSource"];
  unambiguous: boolean;
  unavailable?: boolean;
  companyId: number | null;
  companyKey: string | null;
  hintDomain: string | null;
}

/**
 * Identify the exact employer. Returns the colleague-elected mail domain when
 * one is cached, else the company record's domain as a hint. A missing or
 * junk website (link pages, directories) never makes the employer ambiguous.
 */
export async function resolveInstitutionEmployerDomain(
  employer: string,
  _supplied: string | null,
  overrides: Partial<Deps> = {},
): Promise<ResolvedEmployer> {
  const deps = { ...defaultDeps, ...overrides };
  const organization = normalizeOrganization(employer);
  const none: ResolvedEmployer = { domain: null, source: null, unambiguous: false, companyId: null, companyKey: null, hintDomain: null };
  if (!organization) return none;
  const found = await deps.companySearch(employer);
  if (!found.ok) return { ...none, unavailable: true };
  const exact = found.data.filter((row) => sameInstitution(row.basic_info?.name ?? row.name, employer));
  // Two same-name organizations: never borrow either one's people or domain.
  if (exact.length > 1) return none;
  const companyId = exact.length === 1 ? exact[0].company_id : null;
  const companyKey = companyId !== null ? String(companyId) : `name:${organization}`;
  const info = (exact[0]?.basic_info ?? {}) as Record<string, unknown>;
  const listed = [info.primary_domain, ...(Array.isArray(info.all_domains) ? info.all_domains : []), info.website]
    .map(isInstitutionCandidateDomain).filter((d): d is string => !!d);
  const hintDomain = [...new Set(listed)].length === 1 ? listed[0] : (isInstitutionCandidateDomain(info.primary_domain) ?? null);
  const cached = await deps.cacheGet(domainKey(companyKey), ENRICHMENT_TTL_MS);
  const cachedDomain = isInstitutionCandidateDomain((cached?.profiles?.[0] as { domain?: string } | undefined)?.domain);
  if (cachedDomain) return { domain: cachedDomain, source: "cache", unambiguous: true, companyId, companyKey, hintDomain };
  return { domain: hintDomain, source: hintDomain ? "identified" : null, unambiguous: true, companyId, companyKey, hintDomain };
}

/**
 * Reuse a cached institution rule, else check six likely email holders first.
 * Only unclear evidence escalates to broader coworker searches and batches.
 */
export async function researchInstitutionWorkEmail(
  db: Db,
  input: InstitutionResearchInput,
  overrides: Partial<Deps> = {},
): Promise<InstitutionResearchResult> {
  const deps = { ...defaultDeps, ...overrides };
  const startedAt = Date.now();
  const audit = emptyAudit();
  const employer = input.employer?.trim() ?? "";
  const targetUrl = canonicalLinkedinUrl(input.linkedinUrl);
  if (!normalizeOrganization(employer) || !input.fullName || !targetUrl) {
    audit.reason = "missing_identity_or_employer";
    return { suggestion: null, audit };
  }
  const targetCohort = clinicalCohort(input.title);

  const resolved = await resolveInstitutionEmployerDomain(employer, null, deps);
  if (!resolved.unambiguous || !resolved.companyKey) {
    audit.outcome = resolved.unavailable ? "unavailable" : "no_match";
    audit.reason = resolved.unavailable ? "employer_resolution_unavailable" : "employer_not_unambiguous";
    return { suggestion: null, audit };
  }
  const companyKey = resolved.companyKey;

  const deliver = async (rule: CachedRule, outcome: "reused" | "reconstructed", source: InstitutionResearchAudit["domainSource"]) => {
    audit.domain = rule.domain; audit.domainSource = source; audit.pattern = rule.pattern; audit.supporters = rule.supporters;
    const email = institutionalEmailCandidate(input.fullName!, {
      state: "supported", pattern: rule.pattern, sampleCount: rule.supporters,
      organization: employer, domain: rule.domain, cohort: targetCohort,
    });
    if (!email) { audit.reason = "name_has_multiple_spellings"; return { suggestion: null, audit }; }
    if (await addressBelongsToSomeoneElse(db, email, targetUrl)) { audit.reason = "address_belongs_to_another_person"; return { suggestion: null, audit }; }
    audit.outcome = outcome;
    const suggestion: WorkEmailSuggestion = {
      email, organization: employer, domain: rule.domain, cohort: targetCohort, pattern: rule.pattern,
      sampleCount: rule.supporters, learnedAt: new Date().toISOString(), verification: "unverified",
    };
    return { suggestion, audit };
  };

  // 1. A rule this institution already earned is reused with zero provider calls.
  const cachedRule = (await deps.cacheGet(ruleKey(companyKey), ENRICHMENT_TTL_MS))?.profiles?.[0] as unknown as CachedRule | undefined;
  if (cachedRule?.domain && cachedRule.pattern) return await deliver(cachedRule, "reused", "cache");
  const miss = (await deps.cacheGet(missKey(companyKey), MISS_TTL_MS))?.profiles?.[0] as unknown as { reason?: string } | undefined;
  if (miss?.reason) { audit.reason = miss.reason; return { suggestion: null, audit }; }
  const memoMiss = async (reason: string) => {
    audit.reason = reason;
    await deps.cacheSet(missKey(companyKey), 1, [{ reason }], null);
    return { suggestion: null, audit };
  };

  // 2. Pull current coworkers at the exact employer and its indexed sub-units.
  const indexed = await deps.autocomplete("experience.employment_details.current.company_name", employer);
  const names = [...new Set([employer, ...indexed.filter((n) => isEmployerSubunit(n, employer))])].slice(0, MAX_NAME_VARIANTS);
  const employerFilter = { op: "or", conditions: names.map((value) => ({ field: "experience.employment_details.current.company_name", type: "=", value })) };
  const searchOnce = (flagged: boolean, limit: number) => deps.search({
    filters: flagged
      ? { op: "and", conditions: [employerFilter, { field: "experience.employment_details.current.business_email_verified", type: "=", value: true }] }
      : employerFilter,
    fields: ["crustdata_person_id", "basic_profile", "experience", "professional_network", "social_handles"],
    limit,
  });
  audit.rejections = {};
  const reject = (reason: string) => { audit.rejections![reason] = (audit.rejections![reason] ?? 0) + 1; };
  const pool: Array<{ url: string; name: string; title: string; cohort: string; primary: boolean; flagged: boolean }> = [];
  const seen = new Set<string>([targetUrl]);
  const add = (profiles: Record<string, unknown>[], isFlagged: boolean) => {
    for (const profile of profiles) {
      audit.profilesExamined++;
      const url = profileUrl(profile); const name = personName(profile);
      if (!url || !name) { reject("missing_identity"); continue; }
      if (seen.has(url)) { reject("duplicate_or_target"); continue; }
      const role = employerRole(profile, employer, resolved.companyId);
      if (!role) { reject("current_employer_mismatch"); continue; }
      seen.add(url);
      pool.push({ url, name, title: role.title, cohort: clinicalCohort(role.title), primary: role.primary, flagged: isFlagged });
    }
    // Coworkers whose main job is this employer first; then likely email holders.
    pool.sort((a, b) => Number(b.primary) - Number(a.primary) || Number(b.flagged) - Number(a.flagged));
  };

  // Likely email holders are the cheapest useful starting point. The broad
  // search is an escalation, not an automatic second bill on every hospital.
  const flagged = await searchOnce(true, FLAGGED_SEARCH_LIMIT);
  if (flagged.ok) add(flagged.data.profiles as Record<string, unknown>[], true);
  let broadAttempted = false;
  let broadOk = false;
  const addBroadCoworkers = async () => {
    if (broadAttempted) return;
    broadAttempted = true;
    const broad = await searchOnce(false, BROAD_SEARCH_LIMIT);
    broadOk = broad.ok;
    if (broad.ok) add(broad.data.profiles as Record<string, unknown>[], false);
  };
  if (!flagged.ok || pool.length < INITIAL_CONTACT_SAMPLE) await addBroadCoworkers();
  if (!flagged.ok && !broadOk) {
    audit.outcome = "unavailable"; audit.reason = "colleague_search_unavailable";
    return { suggestion: null, audit };
  }
  audit.colleaguesSelected = pool.length;
  if (pool.length < 3) return await memoMiss("fewer_than_three_current_colleagues");

  // 3. Check six coworkers first. If their evidence is split, keep the exact
  // same election rules and escalate through the remaining bounded pool. A
  // small sample can never bypass a contradiction just to save credits.
  const samples: CoworkerEmail[] = [];
  let election = electInstitutionEmail([], { organization: employer, targetCohort, hintDomain: resolved.hintDomain });
  let contactFailure = false;
  let timedOut = false;
  const contacted = new Set<string>();
  while (contacted.size < pool.length && contacted.size < MAX_CONTACT_PROFILES) {
    if (contacted.size > 0 && Date.now() - startedAt > RESEARCH_BUDGET_MS) { timedOut = true; break; }
    const size = contacted.size === 0
      ? Math.min(INITIAL_CONTACT_SAMPLE, pool.length)
      : Math.min(CONTACT_BATCH, MAX_CONTACT_PROFILES - contacted.size);
    // A broader result can change ranking; identity tracking prevents a new
    // batch from charging again for anyone already checked.
    const slice = pool.filter((c) => !contacted.has(c.url)).slice(0, size);
    if (!slice.length) break;
    for (const colleague of slice) contacted.add(colleague.url);
    const contacts = await deps.contacts(slice.map((c) => c.url), ["business_email"]);
    if (!contacts.ok) { contactFailure = true; break; }
    const byUrl = new Map(contacts.data.map((c) => [canonicalLinkedinUrl(c.linkedin_url), c]));
    for (const colleague of slice) {
      const contact = byUrl.get(colleague.url);
      if (!contact?.business_email) continue;
      samples.push({
        personKey: colleague.url, name: colleague.name, cohort: colleague.cohort, email: contact.business_email,
        providerVerified: contact.business_email_verified === true, primaryEmployer: colleague.primary,
      });
    }
    election = electInstitutionEmail(samples, { organization: employer, targetCohort, hintDomain: resolved.hintDomain });
    if (election.pattern) break;
    if (contacted.size >= pool.length && !broadAttempted && pool.length < MAX_CONTACT_PROFILES) {
      await addBroadCoworkers();
      audit.colleaguesSelected = pool.length;
    }
  }
  audit.domainSupport = election.domainSupport;
  audit.domain = election.domain;
  if ((contactFailure || timedOut) && !election.pattern) {
    audit.outcome = "unavailable"; audit.reason = contactFailure ? "colleague_contacts_unavailable" : "time_budget_reached";
    return { suggestion: null, audit };
  }
  if (!election.domain || !election.pattern) return await memoMiss(election.reason ?? "no_institution_rule");

  // 4. A second-opinion review may veto on a factual problem; outages never block.
  const reviewInput: EmailReasoningInput = {
    name: input.fullName, employer, domain: election.domain, title: input.title ?? "",
    samples: election.supporters.map((s, i) => ({ id: String(i), name: s.name, title: pool.find((p) => p.url === s.personKey)?.title ?? "", email: s.email })),
    proposedPattern: election.pattern,
  };
  const review = await deps.reason(reviewInput);
  const vetoed = !review.error && !!review.decision && review.decision.pattern !== election.pattern && review.decision.blockers.length > 0;
  audit.model = { id: review.model, elapsedMs: review.elapsedMs, requestId: review.requestId, outcome: review.error ?? (vetoed ? "vetoed" : "agreed") };
  if (vetoed) return await memoMiss("review_found_contradiction");

  // 5. Keep provider-verified examples as reusable evidence and cache the rule.
  for (const s of election.supporters.filter((x) => x.providerVerified)) {
    try {
      await observeVerifiedWorkEmail(db, {
        linkedinUrl: s.personKey, fullName: s.name, employer, employerDomain: election.domain,
        title: pool.find((p) => p.url === s.personKey)?.title ?? null, workEmail: s.email, verified: true,
      });
      audit.evidenceSaved++;
    } catch (error) {
      console.warn(`[institution-email] colleague evidence was not saved: ${String(error).slice(0, 160)}`);
    }
  }
  const rule: CachedRule = { domain: election.domain, pattern: election.pattern, supporters: election.supporters.length, resolvedName: employer };
  await deps.cacheSet(ruleKey(companyKey), 1, [rule as unknown as Record<string, unknown>], null);
  await deps.cacheSet(domainKey(companyKey), 1, [{ domain: election.domain, resolvedName: employer }], null);
  return await deliver(rule, "reconstructed", "colleagues");
}
