// Pure institution mail-domain + naming-pattern election from coworker emails.
// No network calls. The people who work somewhere are the source of truth for
// its mail system; a company's listed website is only a hint, never a gate.
import {
  EMAIL_PATTERNS,
  matchingEmailPatterns,
  normalizeDomain,
  normalizeEmail,
  normalizeOrganization,
  type EmailPattern,
} from "./institution-email.ts";

/** Link pages, social networks, directories and mailbox providers are never an employer's mail domain. */
export const NON_INSTITUTION_DOMAINS = new Set([
  // mailbox providers
  "gmail.com", "googlemail.com", "yahoo.com", "ymail.com", "hotmail.com", "outlook.com", "aol.com",
  "icloud.com", "me.com", "mac.com", "msn.com", "live.com", "proton.me", "protonmail.com", "pm.me",
  "gmx.com", "mail.com", "zoho.com", "yandex.com", "comcast.net", "verizon.net", "att.net", "sbcglobal.net",
  // link-in-bio pages and site builders
  "linktr.ee", "linktree.com", "lnk.bio", "linkin.bio", "bio.link", "beacons.ai", "carrd.co", "taplink.cc",
  "campsite.bio", "solo.to", "msha.ke", "linkpop.com", "allmylinks.com", "about.me", "wixsite.com",
  "squarespace.com", "godaddysites.com", "sites.google.com",
  // social and search
  "linkedin.com", "facebook.com", "instagram.com", "twitter.com", "x.com", "tiktok.com", "youtube.com",
  "google.com", "bit.ly", "t.co", "wikipedia.org", "en.wikipedia.org",
  // directories, job boards and listings
  "doximity.com", "healthgrades.com", "vitals.com", "zocdoc.com", "webmd.com", "usnews.com", "freida.ama-assn.org",
  "indeed.com", "glassdoor.com", "crunchbase.com", "mapy.com", "yelp.com", "cortico.health", "npiregistry.com",
]);

export function isInstitutionCandidateDomain(value: unknown): string | null {
  const domain = normalizeDomain(value);
  if (!domain) return null;
  if (NON_INSTITUTION_DOMAINS.has(domain)) return null;
  for (const blocked of NON_INSTITUTION_DOMAINS) if (domain.endsWith(`.${blocked}`)) return null;
  const tld = domain.split(".").at(-1) ?? "";
  return /^[a-z]{2,}$/.test(tld) ? domain : null;
}

const GENERIC_ORG_WORDS = new Set([
  "the", "of", "and", "for", "at", "in", "a", "an", "inc", "llc", "llp", "pc", "pa", "co", "corp",
  "medical", "medicine", "center", "centre", "centers", "health", "healthcare", "hospital", "hospitals",
  "system", "systems", "university", "college", "school", "institute", "clinic", "clinics", "group",
  "network", "care", "services", "service", "regional", "community", "general", "memorial", "national",
  "associates", "partners", "physicians", "practice", "department", "division", "new", "north", "south",
  "east", "west", "saint", "st", "mount", "mt", "city", "county", "state", "foundation", "sciences",
]);

/** Distinctive words (e.g. "maimonides") that a real institutional domain normally carries. */
export function distinctiveOrgTokens(organization: unknown): string[] {
  const org = normalizeOrganization(organization);
  if (!org) return [];
  return [...new Set(org.split(" ").filter((t) => t.length >= 4 && !GENERIC_ORG_WORDS.has(t)))];
}

function orgAcronym(organization: unknown): string | null {
  const org = normalizeOrganization(organization);
  if (!org) return null;
  const letters = org.split(" ").filter((t) => t && !["the", "of", "and", "for", "at", "in", "a", "an"].includes(t)).map((t) => t[0]).join("");
  return letters.length >= 3 ? letters : null;
}

/** Labels of the domain minus the TLD: "med.nyu.edu" -> ["med","nyu"]. */
function domainLabels(domain: string): string[] {
  return domain.split(".").slice(0, -1).filter(Boolean);
}

export function domainRelatesToOrganization(domain: string, organization: unknown): boolean {
  const labels = domainLabels(domain);
  const tokens = distinctiveOrgTokens(organization);
  if (labels.some((label) => tokens.some((t) => label.includes(t) || (label.length >= 5 && t.startsWith(label))))) return true;
  const acronym = orgAcronym(organization);
  return !!acronym && labels.some((label) => label === acronym || label === `${acronym}s`);
}

export interface CoworkerEmail {
  personKey: string;   // canonical profile URL
  name: string;
  cohort: string;
  email: string;
  providerVerified: boolean;
  /** The coworker's primary current job is the target employer. */
  primaryEmployer: boolean;
}

export interface ElectionInput {
  organization: string;
  targetCohort: string;
  /** Domain listed on the company record, if it is a real organization domain. */
  hintDomain?: string | null;
}

export interface ElectionResult {
  domain: string | null;
  pattern: EmailPattern | null;
  supporters: CoworkerEmail[];
  reason?: string;
  domainSupport: Record<string, number>;
}

export const MIN_SUPPORTERS = 3;
const PATTERN_SHARE = 0.8;
const UNANIMOUS_BELOW = 6;

/**
 * Decide the employer's mail domain and naming pattern from coworkers. An
 * example counts only when its address spells that coworker's own name, which
 * binds it to the person; one person counts once. Addresses at unrelated
 * domains (second jobs, old employers) are ignored rather than treated as
 * conflicts. Two credible institutional domains, a split pattern, or a role
 * group visibly using another domain all abstain.
 */
export function electInstitutionEmail(samples: CoworkerEmail[], input: ElectionInput): ElectionResult {
  const hint = isInstitutionCandidateDomain(input.hintDomain);
  const seenPeople = new Set<string>();
  const seenAddresses = new Set<string>();
  const bound: Array<CoworkerEmail & { domain: string; patterns: EmailPattern[] }> = [];
  for (const s of samples) {
    const email = normalizeEmail(s.email);
    const domain = email ? isInstitutionCandidateDomain(email.split("@")[1]) : null;
    if (!email || !domain || seenPeople.has(s.personKey) || seenAddresses.has(email)) continue;
    const patterns = matchingEmailPatterns(s.name, email);
    if (!patterns.length) continue; // opaque IDs and shared mailboxes are neutral
    seenPeople.add(s.personKey);
    seenAddresses.add(email);
    bound.push({ ...s, email, domain, patterns });
  }
  const support: Record<string, number> = {};
  for (const b of bound) support[b.domain] = (support[b.domain] ?? 0) + 1;
  const primaryBound = bound.filter((b) => b.primaryEmployer);
  const related = (domain: string) => {
    if (domain === hint || domainRelatesToOrganization(domain, input.organization)) return true;
    // Brand domains with no visible name link need a clear primary-employer majority.
    const primary = primaryBound.filter((b) => b.domain === domain).length;
    return primary >= 5 && primary / Math.max(1, primaryBound.length) >= 0.6;
  };
  const candidates = Object.entries(support)
    .filter(([domain, n]) => n >= MIN_SUPPORTERS && related(domain))
    .sort((a, b) => b[1] - a[1]);
  const base = { domainSupport: support };
  if (!candidates.length) return { ...base, domain: null, pattern: null, supporters: [], reason: "fewer_than_three_institution_examples" };

  let domain = candidates[0][0];
  if (candidates.length > 1) {
    const cohortCount = (d: string) => bound.filter((b) => b.domain === d && b.cohort === input.targetCohort).length;
    const [first, second] = candidates;
    if (cohortCount(first[0]) !== cohortCount(second[0])) {
      domain = cohortCount(first[0]) > cohortCount(second[0]) ? first[0] : second[0];
    } else if (first[1] < second[1] * 2) {
      return { ...base, domain: null, pattern: null, supporters: [], reason: "multiple_institution_mail_domains" };
    }
  }
  // The target's own role group visibly using a different institutional domain.
  const sameCohortElsewhere = bound.filter((b) => b.cohort === input.targetCohort && b.domain !== domain && related(b.domain)).length;
  const sameCohortHere = bound.filter((b) => b.cohort === input.targetCohort && b.domain === domain).length;
  if (sameCohortElsewhere >= 2 && sameCohortHere === 0) {
    return { ...base, domain: null, pattern: null, supporters: [], reason: "role_group_uses_different_domain" };
  }

  const onDomain = bound.filter((b) => b.domain === domain);
  const tally = new Map<EmailPattern, number>();
  for (const b of onDomain) for (const p of b.patterns) tally.set(p, (tally.get(p) ?? 0) + 1);
  const ranked = [...tally.entries()].sort((a, b) => b[1] - a[1] || EMAIL_PATTERNS.indexOf(a[0]) - EMAIL_PATTERNS.indexOf(b[0]));
  const [winner, count] = ranked[0] ?? [null, 0];
  if (!winner || count < MIN_SUPPORTERS || count / onDomain.length < PATTERN_SHARE) {
    return { ...base, domain, pattern: null, supporters: [], reason: "no_consistent_naming_pattern" };
  }
  // Large samples tolerate a few legacy addresses; small samples must be unanimous.
  const dissent = onDomain.filter((b) => !b.patterns.includes(winner));
  if (dissent.length && onDomain.length < UNANIMOUS_BELOW) {
    return { ...base, domain, pattern: null, supporters: [], reason: "split_naming_convention" };
  }
  // The target's own role group, when visible, must mostly follow the winner.
  const sameRole = onDomain.filter((b) => b.cohort === input.targetCohort);
  if (sameRole.length && sameRole.filter((b) => !b.patterns.includes(winner)).length * 2 >= sameRole.length) {
    return { ...base, domain, pattern: null, supporters: [], reason: "role_group_contradicts_pattern" };
  }
  // Patterns that coincide for every supporter (e.g. "first" vs "flast" never do) must not tie.
  const tied = ranked.filter(([p, n]) => p !== winner && n === count && onDomain.every((b) => b.patterns.includes(winner) === b.patterns.includes(p)));
  if (tied.length) return { ...base, domain, pattern: null, supporters: [], reason: "ambiguous_naming_pattern" };
  return { ...base, domain, pattern: winner, supporters: onDomain.filter((b) => b.patterns.includes(winner)) };
}
