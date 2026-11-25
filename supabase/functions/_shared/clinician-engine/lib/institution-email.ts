// Institutional work-email evidence: learn reusable conventions without
// treating a reconstructed address as a sourced or verified contact.
// No network, DNS, SMTP or provider calls belong in this module.

export const INSTITUTION_EVIDENCE_TTL_MS = 90 * 24 * 60 * 60 * 1000;
export const MIN_INSTITUTION_SAMPLES = 3;

export const EMAIL_PATTERNS = [
  "first.last", "flast", "f.last", "firstlast", "last.first", "lastf",
  "last.f", "first_last", "fmlast", "first.m.last", "first", "last",
] as const;
export type EmailPattern = typeof EMAIL_PATTERNS[number];

type NameParts = { first: string; middle: string; last: string };

const CREDENTIALS = new Set([
  "md", "do", "mbbs", "phd", "dpm", "rn", "bsn", "msn", "dnp", "np", "pa", "pac",
  "facs", "faan", "mph", "faco", "faaos", "faap", "facp", "frcs", "dr", "doctor",
  "prof", "professor", "jr", "sr", "ii", "iii", "iv",
]);
const GENERIC_LOCALS = new Set([
  "info", "contact", "admin", "office", "gme", "residency", "emresidency",
  "fellowship", "nursing", "support", "admissions", "recruitment",
]);
const PATTERN_SET = new Set<string>(EMAIL_PATTERNS);

const asciiToken = (value: string) => value.normalize("NFKD")
  .replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z]/g, "");

export function normalizeDomain(value: unknown): string | null {
  if (typeof value !== "string") return null;
  let domain = value.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "");
  domain = domain.split(/[/?#]/)[0].replace(/\.$/, "");
  if (domain.length > 253 || !/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(domain)) return null;
  const labels = domain.split(".");
  if (labels.length < 2 || labels.some((x) => !x || x.length > 63 || x.startsWith("-") || x.endsWith("-"))) return null;
  return domain;
}

export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  const parts = email.split("@");
  if (parts.length !== 2) return null;
  const [local, rawDomain] = parts;
  const domain = normalizeDomain(rawDomain);
  if (!domain || !/^[a-z0-9][a-z0-9._+-]{0,63}$/.test(local) || local.endsWith(".") || local.includes("..")) return null;
  return `${local}@${domain}`;
}

export function normalizeOrganization(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();
  return normalized ? normalized.slice(0, 200) : null;
}

export function clinicalCohort(title: unknown): string {
  const t = typeof title === "string" ? ` ${title.toLowerCase()} ` : "";
  const has = (re: RegExp) => re.test(t);
  if (has(/\b(resident|residency|fellow|fellowship|intern|internship|pgy[- ]?[1-7]|house officer)\b/)) return "graduate_medical_trainee";
  if (has(/\b(nursing student|student nurse)\b/)) return "nursing_student";
  if (has(/\b(nurse|nursing|np|aprn|crna|cnm|cns|midwife)\b/)) return "nursing";
  if (has(/\b(professor|faculty|academic|lecturer|instructor)\b/)) return "faculty";
  if (has(/\b(physician|doctor|hospitalist|surgeon|md|do)\b/)) return "physician";
  return "other_clinical_staff";
}

export function institutionScope(organization: string, domain: string | null, cohort: string): string {
  const org = normalizeOrganization(organization) ?? "unknown";
  return `${org}|${domain ?? "unknown"}|${cohort}`;
}

export function nameVariants(fullName: unknown): NameParts[] {
  if (typeof fullName !== "string" || fullName.length > 200) return [];
  let name = fullName.trim().replace(/\([^)]*\)|"[^"]*"/g, "");
  const comma = name.split(",");
  if (comma.length > 1 && comma[1].split(/\s+/).some((t) => asciiToken(t) && !CREDENTIALS.has(asciiToken(t)))) {
    name = `${comma[1]} ${comma[0]}`;
  } else {
    name = comma[0];
  }
  const raw = name.split(/\s+/).filter((t) => asciiToken(t) && !CREDENTIALS.has(asciiToken(t)));
  if (raw.length < 2 || raw.some((t) => !asciiToken(t))) return [];
  const first = asciiToken(raw[0]);
  const last = asciiToken(raw[raw.length - 1]);
  const middle = raw.slice(1, -1).map((t) => asciiToken(t)[0]).join("");
  const variants = new Map<string, NameParts>();
  const add = (v: NameParts) => {
    if (v.first && v.last) variants.set(`${v.first}|${v.middle}|${v.last}`, v);
  };
  add({ first, middle, last });
  if (raw[0].includes("-")) {
    const pieces = raw[0].split("-").map(asciiToken).filter(Boolean);
    if (pieces.length > 1) add({ first: pieces[0], middle: pieces[1][0] + middle, last });
  }
  if (raw[raw.length - 1].includes("-")) {
    const pieces = raw[raw.length - 1].split("-").map(asciiToken).filter(Boolean);
    for (const part of pieces) add({ first, middle, last: part });
  }
  if (raw.length > 2) add({ first, middle: "", last: raw.slice(1).map(asciiToken).join("") });
  return [...variants.values()].slice(0, 8);
}

function renderPattern(pattern: EmailPattern, { first, middle, last }: NameParts): string | null {
  switch (pattern) {
    case "first.last": return `${first}.${last}`;
    case "flast": return `${first[0]}${last}`;
    case "f.last": return `${first[0]}.${last}`;
    case "firstlast": return `${first}${last}`;
    case "last.first": return `${last}.${first}`;
    case "lastf": return `${last}${first[0]}`;
    case "last.f": return `${last}.${first[0]}`;
    case "first_last": return `${first}_${last}`;
    case "fmlast": return middle ? `${first[0]}${middle[0]}${last}` : null;
    case "first.m.last": return middle ? `${first}.${middle[0]}.${last}` : null;
    case "first": return first;
    case "last": return last;
  }
}

export function matchingEmailPatterns(fullName: string, emailValue: string): EmailPattern[] {
  const email = normalizeEmail(emailValue);
  if (!email) return [];
  const local = email.split("@")[0];
  if (GENERIC_LOCALS.has(local)) return [];
  return EMAIL_PATTERNS.filter((pattern) => nameVariants(fullName).some((parts) => renderPattern(pattern, parts) === local));
}

export interface InstitutionObservation {
  person_hash: string;
  address_hash: string;
  organization_name: string;
  domain: string;
  cohort: string;
  patterns: string[];
  observed_at: string;
  verified: boolean;
  identity_bound: boolean;
  current_affiliation: boolean;
}

export interface InstitutionKnowledge {
  state: "supported" | "insufficient_evidence" | "ambiguous" | "mixed_or_opaque";
  pattern: EmailPattern | null;
  sampleCount: number;
  organization: string;
  domain: string;
  cohort: string;
}

export function learnInstitutionKnowledge(
  rows: InstitutionObservation[],
  scope: { organization: string; domain: string; cohort: string },
  now = new Date(),
): InstitutionKnowledge {
  const domain = normalizeDomain(scope.domain) ?? scope.domain;
  const organization = normalizeOrganization(scope.organization) ?? scope.organization;
  const seenPeople = new Set<string>();
  const seenAddresses = new Set<string>();
  const usable: InstitutionObservation[] = [];
  for (const row of rows) {
    const age = now.getTime() - Date.parse(row.observed_at);
    if (normalizeOrganization(row.organization_name) !== organization || normalizeDomain(row.domain) !== domain || row.cohort !== scope.cohort) continue;
    if (!row.verified || !row.identity_bound || !row.current_affiliation || !Number.isFinite(age) || age < 0 || age > INSTITUTION_EVIDENCE_TTL_MS) continue;
    if (seenPeople.has(row.person_hash) || seenAddresses.has(row.address_hash)) continue;
    seenPeople.add(row.person_hash);
    seenAddresses.add(row.address_hash);
    usable.push(row);
  }
  const base = { sampleCount: usable.length, organization: scope.organization, domain, cohort: scope.cohort };
  if (usable.length < MIN_INSTITUTION_SAMPLES) return { ...base, state: "insufficient_evidence", pattern: null };
  let common = new Set(EMAIL_PATTERNS as readonly string[]);
  for (const row of usable) {
    const patterns = new Set(row.patterns.filter((p) => PATTERN_SET.has(p)));
    common = new Set([...common].filter((p) => patterns.has(p)));
  }
  if (common.size === 1) return { ...base, state: "supported", pattern: [...common][0] as EmailPattern };
  return { ...base, state: common.size ? "ambiguous" : "mixed_or_opaque", pattern: null };
}

/** Zero or one hypothesis. Multiple spellings/name interpretations abstain. */
export function institutionalEmailCandidate(fullName: string, knowledge: InstitutionKnowledge): string | null {
  if (knowledge.state !== "supported" || !knowledge.pattern) return null;
  const domain = normalizeDomain(knowledge.domain);
  if (!domain) return null;
  const candidates = new Set<string>();
  for (const parts of nameVariants(fullName)) {
    const local = renderPattern(knowledge.pattern, parts);
    if (local && !GENERIC_LOCALS.has(local)) candidates.add(`${local}@${domain}`);
  }
  return candidates.size === 1 ? [...candidates][0] : null;
}

export function hasAddressCollision(
  candidateAddressHash: string,
  targetPersonHash: string,
  rows: Array<Pick<InstitutionObservation, "person_hash" | "address_hash">>,
): boolean {
  return rows.some((row) => row.address_hash === candidateAddressHash && row.person_hash !== targetPersonHash);
}
