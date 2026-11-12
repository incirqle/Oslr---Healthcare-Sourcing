/**
 * Normalizes search results and saved contacts for CSV and clinical PDF exports.
 * Saved enrichment is nested under raw.enriched; no export function fetches data.
 */

import type { Candidate } from "@/components/search/SearchResults";
import type { ProjectCandidate } from "@/types/project";
import { toTitleCase } from "@/components/search/candidate-ui";

export type AnyCandidate = Candidate | ProjectCandidate | Record<string, unknown>;

export interface ExportRow {
  firstName: string;
  lastName: string;
  location: string;
  linkedin: string;
  personalEmail: string;
  personalEmailVerification: string;
  workEmail: string;
  workEmailVerification: string;
  phoneNumbers: string;
  currentTitle: string;
  currentOrg: string;
  education: string;
  avgTenureYears: string;
  currentTenureYears: string;
  totalExperienceYears: string;
}

export interface DossierExperience {
  title: string;
  company: string;
  startDate: string | null;
  endDate: string | null;
  isCurrent: boolean;
  summary: string;
  location: string;
}

export interface DossierEducation {
  school: string;
  degree: string;
  major: string;
  startDate: string | null;
  endDate: string | null;
}

export interface DossierResearch {
  designation: string;
  organisation: string;
  articleCount: number;
  citations: number;
  hIndex: number;
  i10Index: number;
  coAuthorCount: number;
  interests: string[];
  topArticles: { title: string; publication: string; year: string; citations: number; url: string }[];
}

export interface DossierClassification {
  credential: string;
  npi: string;
  specialty: string;
  practiceCity: string;
  industry: string;
}

export interface DossierIndustry {
  total: number;
  count: number;
  byYear: { year: string; total: number }[];
  topCompanies: { name: string; amount: number }[];
  byType: { name: string; amount: number }[];
}

export interface DossierTrial { nctId: string; title: string; status: string; phase: string; sponsor: string; role: string; url: string }
export interface DossierArticle { title: string; journal: string; year: string; url: string }

export interface Dossier {
  fullName: string;
  /** Name with clinical credential, e.g. "Jane Smith, MD". Never "Dr." */
  displayName: string;
  credential: string;
  classification: DossierClassification;
  industry: DossierIndustry | null;
  trials: DossierTrial[];
  pubmed: DossierArticle[];
  personalEmailUnconfirmed: boolean;
  currentTitle: string;
  currentOrg: string;
  location: string;
  specialty: string;
  linkedin: string;
  email: string;
  workEmail: string;
  personalEmail: string;
  phone: string;
  summary: string;
  yearsExperience: string;
  npi: string;
  certifications: string[];
  research: DossierResearch | null;
  experience: DossierExperience[];
  education: DossierEducation[];
  skills: string[];
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const asString = (v: unknown): string =>
  typeof v === "string" ? v : v == null ? "" : String(v);

const asNumber = (v: unknown): number => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

const asArray = <T = unknown>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

function splitName(full: string): { first: string; last: string } {
  const cleaned = full.trim().replace(/\s+/g, " ");
  if (!cleaned) return { first: "", last: "" };
  const parts = cleaned.split(" ");
  if (parts.length === 1) return { first: parts[0], last: "" };
  return { first: parts.slice(0, -1).join(" "), last: parts[parts.length - 1] };
}

function monthsBetween(start: string | null, end: string | null): number {
  if (!start) return 0;
  const s = new Date(start);
  const e = end ? new Date(end) : new Date();
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()) || e < s) return 0;
  return (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth());
}

const oneDecimal = (n: number) => (n > 0 ? (Math.round(n * 10) / 10).toFixed(1) : "");

/** Merge the original provider payload with enrichment already saved on a contact. */
function profileRaw(c: AnyCandidate): Record<string, unknown> {
  const raw = (c as Candidate).raw ?? {};
  const enriched = isObj(raw.enriched) ? raw.enriched : {};
  const merged: Record<string, unknown> = { ...raw };
  // Enrichment wins only where it actually has data: an empty list or blank
  // field must never wipe out experience or education saved on the profile.
  for (const [key, value] of Object.entries(enriched)) {
    if (value == null || value === "" || (Array.isArray(value) && value.length === 0)) continue;
    merged[key] = value;
  }
  // Both shapes describe the same jobs; keep whichever list is richer.
  const hist = asArray(raw.experience_history);
  const exp = asArray(merged.experience);
  if (hist.length && exp.length) {
    if (exp.length >= hist.length) delete merged.experience_history; else delete merged.experience;
  }
  return merged;
}

function extractRawExperience(raw: Record<string, unknown> | undefined): DossierExperience[] {
  if (!raw) return [];
  const entries = [
    ...asArray<Record<string, unknown>>(raw.experience_history),
    ...asArray<Record<string, unknown>>(raw.experience),
  ];
  const seen = new Set<string>();
  return entries.map((entry) => {
    const titleField = entry.title;
    const companyField = entry.company;
    return {
      title: typeof titleField === "string" ? titleField : isObj(titleField) ? asString(titleField.name) : asString(entry.job_title),
      company: typeof companyField === "string" ? companyField : isObj(companyField) ? asString(companyField.name) : asString(entry.company_name ?? entry.job_company_name),
      startDate: asString(entry.start_date ?? entry.job_start_date) || null,
      endDate: asString(entry.end_date ?? entry.job_end_date) || null,
      isCurrent: Boolean(entry.is_current ?? entry.is_primary ?? !entry.end_date),
      summary: asString(entry.summary),
      location: typeof entry.location === "string" ? entry.location : asString(asArray<string>(entry.location_names)[0]),
    };
  }).filter((entry) => {
    const key = `${entry.title}|${entry.company}|${entry.startDate}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return Boolean(entry.title || entry.company);
  });
}

function extractRawEducation(raw: Record<string, unknown> | undefined): DossierEducation[] {
  if (!raw) return [];
  return asArray<Record<string, unknown>>(raw.education).map((entry) => {
    const schoolField = entry.school;
    return {
      school: typeof schoolField === "string" ? schoolField : isObj(schoolField) ? asString(schoolField.name) : asString(entry.school_name),
      degree: asArray<string>(entry.degrees).filter(Boolean).join(", ") || asString(entry.degree),
      major: asArray<string>(entry.majors).filter(Boolean).join(", ") || asString(entry.major),
      startDate: asString(entry.start_date) || null,
      endDate: asString(entry.end_date) || null,
    };
  }).filter((entry) => Boolean(entry.school || entry.degree || entry.major));
}

function pickEmails(c: AnyCandidate): { work: string; personal: string; workVerified: string; personalVerified: string } {
  const raw = profileRaw(c);
  const contact = isObj(raw.contact) ? raw.contact : {};
  const workEmail = asString((c as Candidate).work_email ?? raw.work_email ?? contact.work_email);
  const personalEmail = asString(
    (c as Candidate).personal_email
      ?? asArray<string>(raw.personal_emails)[0]
      ?? asArray<string>(contact.personal_emails)[0],
  );
  const personalVerified = personalEmail ? (raw.recommended_personal_email === personalEmail ? "Deliverable" : "Unverified") : "";
  const workStatus = asString(raw.work_email_status ?? contact.work_email_status).toLowerCase();
  const workVerified = workEmail ? (["valid", "verified", "deliverable"].includes(workStatus) ? "Deliverable" : "Unverified") : "";
  if (!workEmail && !personalEmail && c.email) {
    return { work: asString(c.email), personal: "", workVerified: "Unverified", personalVerified: "" };
  }
  return { work: workEmail, personal: personalEmail, workVerified, personalVerified };
}

function pickPhones(c: AnyCandidate): string {
  const raw = profileRaw(c);
  const contact = isObj(raw.contact) ? raw.contact : {};
  const list = new Set<string>();
  if (c.phone) list.add(asString(c.phone));
  asString(raw.mobile_phone) && list.add(asString(raw.mobile_phone));
  asArray<string>(raw.phone_numbers).forEach((p) => p && list.add(p));
  asArray<string>(contact.phone_numbers).forEach((p) => p && list.add(p));
  return Array.from(list).join(", ");
}

function extractResearch(raw: Record<string, unknown>, originalRaw: Record<string, unknown>): DossierResearch | null {
  void originalRaw;
  const publications: Record<string, unknown> = {};
  const value = isObj(raw.research_profile) ? raw.research_profile : null;
  if (!value) return null;
  const profile = value ?? {};
  const topArticles = asArray<Record<string, unknown>>(profile.top_articles).map((article) => ({
    title: asString(article.title),
    publication: asString(article.publication),
    year: asString(article.year),
    citations: asNumber(article.citations),
    url: asString(article.url),
  }));
  return {
    designation: asString(profile.designation),
    organisation: asString(profile.organisation),
    articleCount: asNumber(profile.article_count ?? publications.count),
    citations: asNumber(profile.citations),
    hIndex: asNumber(profile.h_index),
    i10Index: asNumber(profile.i10_index),
    coAuthorCount: asNumber(profile.co_author_count),
    interests: asArray<string>(profile.interests).filter(Boolean),
    topArticles: topArticles.length ? topArticles : [],
  };
}

function extractNpi(raw: Record<string, unknown>): { npi: string; specialty: string; credential: string; city: string } {
  const intel = isObj(raw.doctor_intel) ? raw.doctor_intel : {};
  const nested = isObj(intel.npi) ? intel.npi : isObj(raw.npi) ? raw.npi : {};
  return {
    npi: asString(nested.npi ?? (typeof raw.npi === "string" ? raw.npi : "")),
    specialty: asString(nested.specialty),
    credential: asString(nested.credential),
    city: asString(nested.city),
  };
}

const CREDENTIALS: [RegExp, string][] = [
  [/\bm\.?\s?d\.?\b|doctor of medicine/i, "MD"],
  [/\bd\.?\s?o\.?\b|doctor of osteopathic/i, "DO"],
  [/\bd\.?\s?p\.?\s?m\.?\b|doctor of podiatric/i, "DPM"],
];

/** Clinical credential from the NPI record first, then medical degrees on the profile. */
export function clinicalCredential(npiCredential: string, degrees: string[]): string {
  const found = new Set<string>();
  for (const source of [npiCredential, ...degrees]) {
    for (const [re, label] of CREDENTIALS) if (source && re.test(source)) found.add(label);
    if (found.size && source === npiCredential) break;
  }
  return ["MD", "DO", "DPM"].filter((c) => found.has(c)).join(", ");
}

function extractIndustry(raw: Record<string, unknown>): DossierIndustry | null {
  const intel = isObj(raw.doctor_intel) ? raw.doctor_intel : {};
  const p = isObj(intel.payments) ? intel.payments : null;
  if (!p || !asNumber(p.total)) return null;
  // Merge the same company listed under different capitalization.
  const companies = new Map<string, { name: string; amount: number }>();
  asArray<Record<string, unknown>>(p.topCompanies).forEach((c) => {
    const name = toTitleCase(asString(c.name)).replace(/\bInc\b\.?/i, "Inc.").trim();
    const key = name.toLowerCase().replace(/[^a-z0-9]/g, "");
    const prev = companies.get(key);
    companies.set(key, { name: prev?.name ?? name, amount: (prev?.amount ?? 0) + asNumber(c.amount) });
  });
  return {
    total: asNumber(p.total),
    count: asNumber(p.count),
    byYear: asArray<Record<string, unknown>>(p.byYear).map((y) => ({ year: asString(y.year), total: asNumber(y.total) })),
    topCompanies: [...companies.values()].sort((a, b) => b.amount - a.amount),
    byType: asArray<Record<string, unknown>>(p.byType).map((t) => ({ name: asString(t.name), amount: asNumber(t.amount) })),
  };
}

function extractTrials(raw: Record<string, unknown>): DossierTrial[] {
  const intel = isObj(raw.doctor_intel) ? raw.doctor_intel : {};
  const t = isObj(intel.trials) ? intel.trials : {};
  return asArray<Record<string, unknown>>(t.studies).map((s) => ({
    nctId: asString(s.nctId), title: asString(s.title), status: toTitleCase(asString(s.status).replace(/_/g, " ")),
    phase: asString(s.phase).replace(/_/g, " ").replace(/PHASE\s?(\d)/gi, "Phase $1"), sponsor: asString(s.sponsor), role: toTitleCase(asString(s.role).replace(/_/g, " ")), url: asString(s.url),
  })).filter((s) => s.title);
}

function extractPubmed(raw: Record<string, unknown>): DossierArticle[] {
  const intel = isObj(raw.doctor_intel) ? raw.doctor_intel : {};
  const pubs = isObj(intel.publications) ? intel.publications : {};
  return asArray<Record<string, unknown>>(pubs.articles).map((a) => ({
    title: asString(a.title), journal: asString(a.journal), year: asString(a.year), url: asString(a.url),
  })).filter((a) => a.title);
}

/** Mirrors the server rule: the address should carry part of the person's name. */
export function emailMatchesName(email: string, fullName: string): boolean {
  if (!email || !fullName) return true;
  const local = email.split("@")[0].toLowerCase().replace(/[^a-z]/g, "");
  const parts = fullName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/,.*$/, "")
    .split(/[\s-]+/).map((t) => t.replace(/[^a-z]/g, "")).filter((t) => t && !["dr", "md", "do", "dpm", "jr", "sr"].includes(t));
  if (!parts.length || !local) return true;
  const first = parts[0], last = parts[parts.length - 1];
  if (parts.some((t) => t.length >= 3 && local.includes(t))) return true;
  return local.includes(first[0] + last) || local.includes(last + first[0]);
}

export function toExportRow(c: AnyCandidate): ExportRow {
  const fullName = asString(c.full_name);
  const { first, last } = splitName(fullName);
  const raw = profileRaw(c);
  const experience = extractRawExperience(raw);
  const education = extractRawEducation(raw);
  const tenures = experience.map((e) => monthsBetween(e.startDate, e.endDate)).filter((m) => m > 0);
  const avgMonths = tenures.length ? tenures.reduce((a, b) => a + b, 0) / tenures.length : 0;
  const current = experience.find((e) => e.isCurrent);
  const currentMonths = current ? monthsBetween(current.startDate, current.endDate) : 0;
  const totalYears = (c as Candidate).years_experience ?? raw.inferred_years_experience;
  const totalNum = asNumber(totalYears);
  const emails = pickEmails(c);

  return {
    firstName: first,
    lastName: last,
    location: asString(c.location),
    linkedin: asString(c.linkedin_url ?? raw.linkedin_url),
    personalEmail: emails.personal,
    personalEmailVerification: emails.personalVerified,
    workEmail: emails.work,
    workEmailVerification: emails.workVerified,
    phoneNumbers: pickPhones(c),
    currentTitle: asString(c.title),
    currentOrg: asString(c.current_employer),
    education: education.map((e) => [e.degree, e.school].filter(Boolean).join(", ")).filter(Boolean).join("; "),
    avgTenureYears: oneDecimal(avgMonths / 12),
    currentTenureYears: oneDecimal(currentMonths / 12),
    totalExperienceYears: totalNum > 0 ? oneDecimal(totalNum) : oneDecimal(tenures.reduce((a, b) => a + b, 0) / 12),
  };
}

export function toDossier(c: AnyCandidate): Dossier {
  const originalRaw = (c as Candidate).raw ?? {};
  const raw = profileRaw(c);
  const emails = pickEmails(c);
  const experience = extractRawExperience(raw);
  const education = extractRawEducation(raw);
  const npi = extractNpi(raw);
  const fromCandidate = asArray<string>(c.skills).filter(Boolean);
  const skillSource = [raw.skills, raw.clinical_skills, raw.all_skills].map((v) => asArray<unknown>(v).map((x) => typeof x === "string" ? x : isObj(x) ? asString(x.name) : "").filter(Boolean)).find((l) => l.length) ?? [];
  const skills = fromCandidate.length ? fromCandidate : skillSource;
  const certifications = [...asArray<unknown>(raw.certifications), ...asArray<unknown>(raw.licenses)]
    .map((item) => typeof item === "string" ? item : isObj(item) ? asString(item.name ?? item.title ?? item.state) : "")
    .filter(Boolean);
  const totalYears = asNumber((c as Candidate).years_experience ?? raw.inferred_years_experience);

  const fullName = toTitleCase(asString(c.full_name ?? raw.full_name)).replace(/^dr\.?\s+/i, "").replace(/,\s*(md|do|dpm)\b.*$/i, "");
  const credential = clinicalCredential(npi.credential, education.map((e) => e.degree));

  return {
    fullName,
    displayName: credential ? `${fullName}, ${credential}` : fullName,
    credential,
    classification: {
      credential,
      npi: npi.npi,
      specialty: toTitleCase(npi.specialty),
      practiceCity: toTitleCase(npi.city),
      industry: asString(raw.job_company_industry),
    },
    industry: extractIndustry(raw),
    trials: extractTrials(raw),
    pubmed: extractPubmed(raw),
    personalEmailUnconfirmed: !!emails.personal && !emailMatchesName(emails.personal, fullName),
    currentTitle: toTitleCase(asString(c.title ?? raw.job_title)),
    currentOrg: toTitleCase(asString(c.current_employer ?? raw.job_company_name)),
    location: toTitleCase(asString(c.location ?? [raw.location_locality, raw.location_region].filter(Boolean).join(", "))),
    specialty: toTitleCase(asString(raw.specialty ?? raw.primary_specialty ?? raw.sub_specialty ?? npi.specialty)),
    linkedin: asString(c.linkedin_url ?? raw.linkedin_url),
    email: emails.work || emails.personal || asString(c.email),
    workEmail: emails.work,
    personalEmail: emails.personal,
    phone: pickPhones(c),
    summary: asString(raw.summary) || asString((c as Candidate).summary),
    yearsExperience: totalYears > 0 ? `${Number.isInteger(totalYears) ? totalYears : oneDecimal(totalYears)} years` : "",
    npi: npi.npi,
    certifications: [...new Set(certifications)],
    research: extractResearch(raw, originalRaw),
    experience: experience.map((e) => ({
      ...e,
      title: toTitleCase(e.title),
      company: toTitleCase(e.company),
      location: toTitleCase(e.location),
    })),
    education,
    skills,
  };
}
