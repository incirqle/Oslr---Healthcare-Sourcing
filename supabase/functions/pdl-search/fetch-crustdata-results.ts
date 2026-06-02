/**
 * fetch-crustdata-results.ts — CrustData PersonDB API client with retry logic,
 * preview mode, and response mapping to FormattedCandidate interface.
 */

import type { FormattedCandidate } from "./format-results.ts";
import type { CrustDataQuery } from "./build-crustdata-query.ts";

const CRUSTDATA_BASE_URL = "https://api.crustdata.com";

interface CrustDataResult {
  ok: boolean;
  data: CrustDataResponse;
  error?: { code: string; message: string; retryable: boolean };
}

interface CrustDataResponse {
  total_results: number;
  next_cursor: string | null;
  results: CrustDataPerson[];
}

interface CrustDataEmployer {
  name: string | null;
  linkedin_id: string | null;
  company_id: number | null;
  company_website_domain: string | null;
  company_linkedin_profile_url: string | null;
  title: string | null;
  description: string | null;
  location: string | null;
  start_date: string | null;
  end_date: string | null;
  company_headquarters_country: string | null;
  company_headcount_latest: number | null;
  company_industries: string[] | null;
  company_type: string | null;
  seniority_level: string | null;
  function_category: string | null;
  years_at_company_raw: number | null;
  business_email_verified: boolean | null;
}

interface CrustDataEducation {
  degree_name: string | null;
  institute_name: string | null;
  field_of_study: string | null;
  start_date: string | null;
  end_date: string | null;
}

interface CrustDataPerson {
  person_id: number;
  name: string;
  first_name: string | null;
  last_name: string | null;
  headline: string | null;
  summary: string | null;
  region: string | null;
  profile_picture_url: string | null;
  linkedin_profile_url: string | null;
  flagship_profile_url: string | null;
  emails: string[] | null;
  twitter_handle: string | null;
  skills: string[] | null;
  languages: string[] | null;
  num_of_connections: number | null;
  years_of_experience_raw: number | null;
  recently_changed_jobs: boolean | null;
  current_employers: CrustDataEmployer[] | null;
  past_employers: CrustDataEmployer[] | null;
  all_employers: CrustDataEmployer[] | null;
  education_background: CrustDataEducation[] | null;
  certifications: { name: string; issued_date: string | null; issuer_organization: string | null }[] | null;
  location_details: {
    city: string | null;
    state: string | null;
    country: string | null;
    continent: string | null;
  } | null;
}

async function fetchCrustDataWithRetry(
  endpoint: string,
  body: unknown,
  maxRetries = 3
): Promise<CrustDataResult> {
  const apiKey = Deno.env.get("CRUSTDATA_API_KEY");
  if (!apiKey) {
    return {
      ok: false,
      data: { total_results: 0, next_cursor: null, results: [] },
      error: { code: "NO_API_KEY", message: "CRUSTDATA_API_KEY not configured", retryable: false },
    };
  }

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(`${CRUSTDATA_BASE_URL}${endpoint}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (res.status === 429) {
        const wait = Math.pow(2, attempt) * 1000;
        console.warn(`[CrustData] Rate limited (429), retry ${attempt + 1}/${maxRetries} in ${wait}ms`);
        if (attempt < maxRetries) {
          await new Promise(r => setTimeout(r, wait));
          continue;
        }
        return {
          ok: false,
          data: { total_results: 0, next_cursor: null, results: [] },
          error: { code: "RATE_LIMITED", message: "CrustData rate limit exceeded", retryable: true },
        };
      }

      if (res.status === 402) {
        return {
          ok: false,
          data: { total_results: 0, next_cursor: null, results: [] },
          error: { code: "CREDITS_EXHAUSTED", message: "CrustData credits exhausted", retryable: false },
        };
      }

      if (!res.ok) {
        const errText = await res.text();
        console.error(`[CrustData] Error ${res.status}: ${errText}`);
        return {
          ok: false,
          data: { total_results: 0, next_cursor: null, results: [] },
          error: { code: "API_ERROR", message: `CrustData returned ${res.status}: ${errText}`, retryable: res.status >= 500 },
        };
      }

      const data = await res.json();
      return { ok: true, data };
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        const wait = Math.pow(2, attempt) * 1000;
        console.warn(`[CrustData] Network error, retry ${attempt + 1}/${maxRetries} in ${wait}ms`);
        await new Promise(r => setTimeout(r, wait));
      }
    }
  }

  return {
    ok: false,
    data: { total_results: 0, next_cursor: null, results: [] },
    error: {
      code: "NETWORK_ERROR",
      message: `CrustData fetch failed: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
      retryable: true,
    },
  };
}

export async function runCrustDataPreview(query: CrustDataQuery): Promise<number> {
  const previewQuery = { ...query, preview: true, count: 1 };
  const result = await fetchCrustDataWithRetry("/screener/persondb/search", previewQuery);
  if (!result.ok) {
    console.error("[CrustData Preview] Failed:", result.error);
    return 0;
  }
  return result.data.total_results || 0;
}

export async function fetchCrustDataProfiles(
  query: CrustDataQuery
): Promise<{ total: number; profiles: CrustDataPerson[]; cursor: string | null }> {
  const result = await fetchCrustDataWithRetry("/screener/persondb/search", query);
  if (!result.ok) {
    console.error("[CrustData Search] Failed:", result.error);
    return { total: 0, profiles: [], cursor: null };
  }
  return {
    total: result.data.total_results || 0,
    profiles: result.data.results || [],
    cursor: result.data.next_cursor || null,
  };
}

const CLINICAL_KEYWORDS = [
  "nurs", "surg", "medic", "clinical", "patient", "diagnos", "therap",
  "pharma", "anesthe", "radiol", "cardio", "ortho", "neuro", "oncol",
  "pediatr", "obstet", "icu", "emt", "paramedic", "bls", "acls", "pals",
  "epic", "cerner", "hipaa", "ehr", "emr", "icd", "cpt",
];

function isClinicalSkill(skill: string): boolean {
  const lower = skill.toLowerCase();
  return CLINICAL_KEYWORDS.some(kw => lower.includes(kw));
}

export function mapCrustDataPerson(person: CrustDataPerson): FormattedCandidate {
  const currentEmployer = person.current_employers?.[0] ?? null;
  const allSkills = person.skills ?? [];
  const clinicalSkills = allSkills.filter(isClinicalSkill);

  const experienceHistory = (person.all_employers ?? []).map(emp => ({
    company_name: emp.name,
    title: emp.title,
    start_date: emp.start_date,
    end_date: emp.end_date,
    is_primary: emp.end_date === null,
    company_industry: emp.company_industries?.[0] ?? null,
    company_size: emp.company_headcount_latest ? String(emp.company_headcount_latest) : null,
    location: emp.location,
  }));

  const education = (person.education_background ?? []).map(edu => ({
    school_name: edu.institute_name,
    degrees: edu.degree_name ? [edu.degree_name] : [],
    majors: edu.field_of_study ? [edu.field_of_study] : [],
    start_date: edu.start_date,
    end_date: edu.end_date,
  }));

  const emails = person.emails ?? [];
  const workEmail =
    emails.find(e => !e.includes("gmail") && !e.includes("yahoo") && !e.includes("hotmail") && !e.includes("outlook")) ?? null;
  const personalEmail =
    emails.find(e => e.includes("gmail") || e.includes("yahoo") || e.includes("hotmail") || e.includes("outlook")) ?? null;

  const certifications = (person.certifications ?? []).map(c => c.name).filter(Boolean);

  return {
    id: `cd_${person.person_id}`,
    full_name: person.name || "Unknown",
    first_name: person.first_name || "",
    last_name: person.last_name || "",
    job_title: currentEmployer?.title || "",
    job_company_name: currentEmployer?.name || "",
    job_company_id: currentEmployer?.company_id ? String(currentEmployer.company_id) : null,
    job_company_industry: currentEmployer?.company_industries?.[0] || "",
    linkedin_url: person.linkedin_profile_url || null,
    location_name: person.region || "",
    location_locality: person.location_details?.city || "",
    location_region: person.location_details?.state || "",
    location_country: person.location_details?.country || "us",
    headline: person.headline || "",
    summary: person.summary || "",
    job_summary: currentEmployer?.description || "",
    skills: allSkills.slice(0, 20),
    clinical_skills: clinicalSkills,
    all_skills: allSkills,
    experience: (person.all_employers ?? []) as unknown as Record<string, unknown>[],
    experience_history: experienceHistory,
    education,
    certifications,
    inferred_years_experience: person.years_of_experience_raw ?? null,
    years_experience: person.years_of_experience_raw ?? 0,
    gender: null,
    emails,
    email: emails[0] ?? null,
    work_email: workEmail,
    personal_email: personalEmail,
    phone: null,
    mobile_phone: null,
    phone_numbers: [],
    has_contact_info: emails.length > 0,
    profiles: person.linkedin_profile_url
      ? [{ network: "linkedin", url: person.linkedin_profile_url }]
      : [],
    inferred_salary: null,
    job_title_sub_role: currentEmployer?.function_category || null,
    job_title_role: null,
    job_start_date: currentEmployer?.start_date || null,
    job_company_size: currentEmployer?.company_headcount_latest ? String(currentEmployer.company_headcount_latest) : null,
    job_company_location_name: currentEmployer?.location || null,
    job_company_location_locality: null,
    job_company_location_region: null,
    profile_pic_url: person.profile_picture_url || null,
    github_url: null,
    facebook_url: null,
    twitter_url: person.twitter_handle ? `https://twitter.com/${person.twitter_handle}` : null,
    sex: null,
    birth_year: null,
    industry: currentEmployer?.company_industries?.[0] || null,
    interests: [],
    job_title_levels: currentEmployer?.seniority_level ? [currentEmployer.seniority_level] : [],
    job_onet_broad_occupation: null,
    job_onet_specific_occupation: null,
    relevance_score: 50,
    ai_match_reason: null,
  };
}

export function mapCrustDataResults(persons: CrustDataPerson[]): FormattedCandidate[] {
  return persons.map(mapCrustDataPerson);
}
