// Server-only persistence for institutional email evidence. Raw colleague
// addresses and names are never copied into this shared cache: only one-way
// person/address hashes and their supported naming patterns are retained.
import {
  clinicalCohort,
  hasAddressCollision,
  INSTITUTION_EVIDENCE_TTL_MS,
  institutionalEmailCandidate,
  institutionScope,
  learnInstitutionKnowledge,
  matchingEmailPatterns,
  normalizeDomain,
  normalizeEmail,
  normalizeOrganization,
  type InstitutionObservation,
} from "./institution-email.ts";

interface Db {
  from: (table: string) => any;
}

async function digest(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export interface WorkEmailEvidenceInput {
  linkedinUrl: string;
  fullName: string | null;
  employer: string | null;
  employerDomain?: string | null;
  title?: string | null;
  workEmail: string;
  verified: boolean;
}

/** Record only provider-verified, current-employer, exact-domain evidence. */
export async function observeVerifiedWorkEmail(db: Db, input: WorkEmailEvidenceInput): Promise<void> {
  if (!input.verified) return;
  const email = normalizeEmail(input.workEmail);
  const organization = normalizeOrganization(input.employer);
  const domain = normalizeDomain(input.employerDomain);
  if (!email || !organization || !domain || email.split("@")[1] !== domain || !input.fullName || !input.linkedinUrl) return;
  const cohort = clinicalCohort(input.title);
  const scopeKey = institutionScope(organization, domain, cohort);
  const [personHash, addressHash] = await Promise.all([digest(input.linkedinUrl), digest(email)]);
  const now = new Date();
  await db.from("institution_email_evidence").upsert({
    scope_key: scopeKey,
    person_hash: personHash,
    address_hash: addressHash,
    organization_key: organization,
    organization_name: input.employer!.slice(0, 200),
    domain,
    cohort,
    patterns: matchingEmailPatterns(input.fullName, email),
    observed_at: now.toISOString(),
    expires_at: new Date(now.getTime() + INSTITUTION_EVIDENCE_TTL_MS).toISOString(),
    verified: true,
    identity_bound: true,
    current_affiliation: true,
  }, { onConflict: "scope_key,person_hash,address_hash" });
}

export interface WorkEmailSuggestion {
  email: string;
  organization: string;
  domain: string;
  cohort: string;
  pattern: string;
  sampleCount: number;
  learnedAt: string;
  verification: "unverified";
}

async function rowsFor(db: Db, organization: string, domain: string | null, cohort: string): Promise<InstitutionObservation[]> {
  let query = db.from("institution_email_evidence")
    .select("person_hash,address_hash,organization_name,domain,cohort,patterns,observed_at,verified,identity_bound,current_affiliation")
    .eq("organization_key", organization)
    .eq("cohort", cohort)
    .eq("verified", true)
    .eq("identity_bound", true)
    .eq("current_affiliation", true)
    .gt("expires_at", new Date().toISOString())
    .order("observed_at", { ascending: false })
    .limit(500);
  if (domain) query = query.eq("domain", domain);
  const { data, error } = await query;
  if (error) {
    console.warn(`[institution-email] evidence read failed: ${String(error.message).slice(0, 160)}`);
    return [];
  }
  return (data ?? []) as InstitutionObservation[];
}

/**
 * Reuse learned knowledge for the exact organization + role cohort. Without a
 * supplied domain, exactly one supported domain must exist; affiliate/domain
 * ambiguity always abstains. The result is explicitly unverified and free.
 */
export async function suggestInstitutionWorkEmail(db: Db, input: {
  linkedinUrl: string;
  fullName: string | null;
  employer: string | null;
  employerDomain?: string | null;
  title?: string | null;
}): Promise<WorkEmailSuggestion | null> {
  const organization = normalizeOrganization(input.employer);
  const suppliedDomain = normalizeDomain(input.employerDomain);
  if (!organization || !input.fullName || !input.linkedinUrl) return null;
  const cohort = clinicalCohort(input.title);
  const rows = await rowsFor(db, organization, suppliedDomain, cohort);
  if (rows.length < 3) return null;
  const domains = suppliedDomain ? [suppliedDomain] : [...new Set(rows.map((r) => normalizeDomain(r.domain)).filter((d): d is string => !!d))];
  const supported = domains.map((domain) => learnInstitutionKnowledge(rows, {
    organization: input.employer!, domain, cohort,
  })).filter((k) => k.state === "supported");
  // Never choose between multiple academic, clinical or affiliate domains.
  if (supported.length !== 1) return null;
  const email = institutionalEmailCandidate(input.fullName, supported[0]);
  if (!email) return null;
  const [candidateHash, targetPersonHash] = await Promise.all([digest(email), digest(input.linkedinUrl)]);
  const { data: collisions, error } = await db.from("institution_email_evidence")
    .select("person_hash,address_hash").eq("address_hash", candidateHash).limit(2);
  if (error || hasAddressCollision(candidateHash, targetPersonHash, (collisions ?? []) as Array<{ person_hash: string; address_hash: string }>)) return null;
  return {
    email,
    organization: input.employer!,
    domain: supported[0].domain,
    cohort,
    pattern: supported[0].pattern!,
    sampleCount: supported[0].sampleCount,
    learnedAt: new Date().toISOString(),
    verification: "unverified",
  };
}
