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

export interface Dossier {
  fullName: string;
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
  return { ...raw, ...enriched };
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
  const doctorIntel = isObj(originalRaw.doctor_intel) ? originalRaw.doctor_intel : {};
  const publications = isObj(doctorIntel.publications) ? doctorIntel.publications : {};
  const value = isObj(raw.research_profile) ? raw.research_profile : null;
  if (!value && !isObj(doctorIntel.publications)) return null;
  const profile = value ?? {};
  const pubmedArticles = asArray<Record<string, unknown>>(publications.articles).map((article) => ({
    title: asString(article.title),
    publication: asString(article.journal),
    year: asString(article.year),
    citations: 0,
    url: asString(article.url),
  }));
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
    topArticles: topArticles.length ? topArticles : pubmedArticles,
  };
}

function extractNpi(raw: Record<string, unknown>): { npi: string; specialty: string } {
  const intel = isObj(raw.doctor_intel) ? raw.doctor_intel : {};
  const nested = isObj(intel.npi) ? intel.npi : isObj(raw.npi) ? raw.npi : {};
  return {
    npi: asString(nested.npi ?? (typeof raw.npi === "string" ? raw.npi : "")),
    specialty: asString(nested.specialty),
  };
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
  const skills = fromCandidate.length ? fromCandidate : asArray<string>(raw.skills).filter(Boolean);
  const certifications = [...asArray<unknown>(raw.certifications), ...asArray<unknown>(raw.licenses)]
    .map((item) => typeof item === "string" ? item : isObj(item) ? asString(item.name ?? item.title ?? item.state) : "")
    .filter(Boolean);
  const totalYears = asNumber((c as Candidate).years_experience ?? raw.inferred_years_experience);

  return {
    fullName: toTitleCase(asString(c.full_name ?? raw.full_name)),
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
