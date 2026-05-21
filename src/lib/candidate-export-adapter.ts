/**
 * Adapter that normalizes either a live PDL search Candidate (with `raw` payload)
 * or a stored project_candidates row into:
 *   - ExportRow: flat Juicebox-style CSV columns
 *   - Dossier: structured per-candidate PDF data
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
  github: string;
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

export interface Dossier {
  fullName: string;
  currentTitle: string;
  currentOrg: string;
  location: string;
  linkedin: string;
  email: string;
  phone: string;
  summary: string;
  experience: DossierExperience[];
  education: DossierEducation[];
  skills: string[];
}

// ---------- helpers ----------

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const asString = (v: unknown): string =>
  typeof v === "string" ? v : v == null ? "" : String(v);

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

// Extract experience entries from raw PDL data on a search candidate.
interface RawExp {
  title: string;
  company: string;
  startDate: string | null;
  endDate: string | null;
  isCurrent: boolean;
  summary: string;
  location: string;
}

function extractRawExperience(raw: Record<string, unknown> | undefined): RawExp[] {
  if (!raw) return [];
  const entries = [
    ...asArray<Record<string, unknown>>(raw.experience_history),
    ...asArray<Record<string, unknown>>(raw.experience),
  ];
  return entries.map((entry) => {
    const titleField = entry.title;
    const companyField = entry.company;
    return {
      title:
        typeof titleField === "string"
          ? titleField
          : isObj(titleField)
            ? asString(titleField.name)
            : asString(entry.job_title),
      company:
        typeof companyField === "string"
          ? companyField
          : isObj(companyField)
            ? asString(companyField.name)
            : asString(entry.company_name ?? entry.job_company_name),
      startDate: asString(entry.start_date ?? entry.job_start_date) || null,
      endDate: asString(entry.end_date ?? entry.job_end_date) || null,
      isCurrent: Boolean(entry.is_current ?? entry.is_primary ?? !entry.end_date),
      summary: asString(entry.summary),
      location:
        typeof entry.location === "string"
          ? entry.location
          : asString(asArray<string>(entry.location_names)[0]),
    };
  });
}

function extractRawEducation(raw: Record<string, unknown> | undefined): DossierEducation[] {
  if (!raw) return [];
  return asArray<Record<string, unknown>>(raw.education).map((entry) => {
    const schoolField = entry.school;
    return {
      school:
        typeof schoolField === "string"
          ? schoolField
          : isObj(schoolField)
            ? asString(schoolField.name)
            : asString(entry.school_name),
      degree: asArray<string>(entry.degrees).filter(Boolean).join(", "),
      major: asArray<string>(entry.majors).filter(Boolean).join(", "),
      startDate: asString(entry.start_date) || null,
      endDate: asString(entry.end_date) || null,
    };
  });
}

function pickEmails(c: AnyCandidate): { work: string; personal: string; workVerified: string; personalVerified: string } {
  const raw = (c as Candidate).raw;
  const workEmail = asString((c as Candidate).work_email ?? raw?.work_email);
  const personalEmail = asString(
    (c as Candidate).personal_email ?? asArray<string>(raw?.personal_emails)[0],
  );
  // Verification: PDL gives recommended_personal_email + work_email_status when enriched.
  const personalVerified = personalEmail ? (raw?.recommended_personal_email === personalEmail ? "Deliverable" : "Unverified") : "";
  const workVerified = workEmail
    ? asString(raw?.work_email_status) === "valid" || asString(raw?.work_email_status) === "verified"
      ? "Deliverable"
      : workEmail
        ? "Unverified"
        : ""
    : "";

  // Fallback: if no split available, use top-level email as work email.
  if (!workEmail && !personalEmail && c.email) {
    return { work: asString(c.email), personal: "", workVerified: "Unverified", personalVerified: "" };
  }
  return { work: workEmail, personal: personalEmail, workVerified, personalVerified };
}

function pickGithub(raw: Record<string, unknown> | undefined): string {
  if (!raw) return "";
  const profiles = asArray<Record<string, unknown>>(raw.profiles);
  for (const p of profiles) {
    const net = asString(p.network).toLowerCase();
    if (net === "github") return asString(p.url);
  }
  const github = asString(raw.github_url);
  return github;
}

function pickPhones(c: AnyCandidate): string {
  const raw = (c as Candidate).raw;
  const list = new Set<string>();
  if (c.phone) list.add(asString(c.phone));
  asArray<string>(raw?.phone_numbers).forEach((p) => p && list.add(p));
  return Array.from(list).join(", ");
}

// ---------- public API ----------

export function toExportRow(c: AnyCandidate): ExportRow {
  const fullName = asString(c.full_name);
  const { first, last } = splitName(fullName);
  const raw = (c as Candidate).raw;
  const experience = extractRawExperience(raw);
  const education = extractRawEducation(raw);

  const tenures = experience.map((e) => monthsBetween(e.startDate, e.endDate)).filter((m) => m > 0);
  const avgMonths = tenures.length ? tenures.reduce((a, b) => a + b, 0) / tenures.length : 0;
  const current = experience.find((e) => e.isCurrent);
  const currentMonths = current ? monthsBetween(current.startDate, current.endDate) : 0;
  const totalYears = (c as Candidate).years_experience ?? asString(raw?.inferred_years_experience);
  const totalNum = typeof totalYears === "number" ? totalYears : Number(totalYears) || 0;

  const emails = pickEmails(c);

  return {
    firstName: first,
    lastName: last,
    location: asString(c.location),
    linkedin: asString(c.linkedin_url),
    personalEmail: emails.personal,
    personalEmailVerification: emails.personalVerified,
    workEmail: emails.work,
    workEmailVerification: emails.workVerified,
    phoneNumbers: pickPhones(c),
    github: pickGithub(raw),
    currentTitle: asString(c.title),
    currentOrg: asString(c.current_employer),
    education: education.map((e) => e.school).filter(Boolean).join(", "),
    avgTenureYears: oneDecimal(avgMonths / 12),
    currentTenureYears: oneDecimal(currentMonths / 12),
    totalExperienceYears: totalNum > 0 ? oneDecimal(totalNum) : oneDecimal(tenures.reduce((a, b) => a + b, 0) / 12),
  };
}

export function toDossier(c: AnyCandidate): Dossier {
  const raw = (c as Candidate).raw;
  const emails = pickEmails(c);
  const experience = extractRawExperience(raw);
  const education = extractRawEducation(raw);
  const skills = (() => {
    const fromCandidate = asArray<string>(c.skills);
    if (fromCandidate.length) return fromCandidate.filter(Boolean);
    return asArray<string>(raw?.skills).filter(Boolean);
  })();

  return {
    fullName: toTitleCase(asString(c.full_name)),
    currentTitle: toTitleCase(asString(c.title)),
    currentOrg: toTitleCase(asString(c.current_employer)),
    location: toTitleCase(asString(c.location)),
    linkedin: asString(c.linkedin_url),
    email: emails.work || emails.personal || asString(c.email),
    phone: pickPhones(c),
    summary: asString(raw?.summary) || asString((c as Candidate).summary),
    experience: experience.map((e) => ({
      title: toTitleCase(e.title),
      company: toTitleCase(e.company),
      startDate: e.startDate,
      endDate: e.endDate,
      isCurrent: e.isCurrent,
      summary: e.summary,
      location: toTitleCase(e.location),
    })),
    education,
    skills,
  };
}
