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
      // Strip any stray `count` field — PersonDB rejects when both `count` and `limit` are present.
      if (body && typeof body === "object") {
        delete (body as Record<string, unknown>).count;
      }
      console.log(`[CRUSTDATA PAYLOAD] ${endpoint}`, JSON.stringify(body));
      const res = await fetch(`${CRUSTDATA_BASE_URL}${endpoint}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "x-api-version": "2025-11-01",
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

      const rawJson = await res.json();
      const rj = (rawJson && typeof rawJson === "object") ? (rawJson as Record<string, unknown>) : {};
      console.log("[CRUSTDATA RAW TOP KEYS]", JSON.stringify(Object.keys(rj)));
      const rawResults: unknown[] = Array.isArray(rj.results)
        ? (rj.results as unknown[])
        : Array.isArray(rj.profiles)
          ? (rj.profiles as unknown[])
          : Array.isArray(rj.data)
            ? (rj.data as unknown[])
            : [];
      if (rawResults.length > 0) {
        const first = rawResults[0] as Record<string, unknown>;
        console.log("[CRUSTDATA RAW KEYS]", JSON.stringify(Object.keys(first)));
        const employerSample =
          (first.current_employers as unknown[] | undefined)?.[0] ??
          (first.currentEmployers as unknown[] | undefined)?.[0] ??
          (first.employers as unknown[] | undefined)?.[0] ??
          ("NOT FOUND - employer-ish keys: " + Object.keys(first).filter(k => k.toLowerCase().includes("employ") || k.toLowerCase().includes("experience") || k.toLowerCase().includes("job")).join(","));
        console.log("[CRUSTDATA RAW EMPLOYER]", JSON.stringify(employerSample));
      } else {
        console.log("[CRUSTDATA RAW KEYS] no results array found");
      }
      const data = normalizeCrustDataResponse(rawJson);
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

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function normalizeEmployer(raw: unknown): CrustDataEmployer {
  const emp = asRecord(raw);
  return {
    name: (emp.name ?? emp.company_name) as string | null ?? null,
    linkedin_id: (emp.linkedin_id ?? null) as string | null,
    company_id: typeof emp.company_id === "number" ? emp.company_id : null,
    company_website_domain: (emp.company_website_domain ?? null) as string | null,
    company_linkedin_profile_url: (emp.company_professional_network_profile_url ?? emp.company_linkedin_profile_url ?? null) as string | null,
    title: (emp.title ?? null) as string | null,
    description: (emp.description ?? null) as string | null,
    location: (emp.location ?? null) as string | null,
    start_date: (emp.start_date ?? null) as string | null,
    end_date: (emp.end_date ?? null) as string | null,
    company_headquarters_country: (emp.company_headquarters_country ?? null) as string | null,
    company_headcount_latest: typeof emp.company_headcount_latest === "number" ? emp.company_headcount_latest : null,
    company_industries: Array.isArray(emp.company_industries) ? emp.company_industries as string[] : null,
    company_type: (emp.company_type ?? null) as string | null,
    seniority_level: (emp.seniority_level ?? null) as string | null,
    function_category: (emp.function_category ?? null) as string | null,
    years_at_company_raw: typeof emp.years_at_company_raw === "number" ? emp.years_at_company_raw : null,
    business_email_verified: typeof emp.business_email_verified === "boolean" ? emp.business_email_verified : null,
  };
}

function normalizeCrustDataPerson(raw: unknown): CrustDataPerson {
  const profile = asRecord(raw);
  const basic = asRecord(profile.basic_profile);
  const location = asRecord(basic.location);
  const social = asRecord(profile.social_handles);
  const professionalNetworkIdentifier = asRecord(social.professional_network_identifier);
  const professionalNetwork = asRecord(profile.professional_network);
  const skills = asRecord(profile.skills);
  const experience = asRecord(profile.experience);
  const employmentDetails = asRecord(experience.employment_details);
  const education = asRecord(profile.education);

  const current = Array.isArray(employmentDetails.current) ? employmentDetails.current.map(normalizeEmployer) : [];
  const past = Array.isArray(employmentDetails.past) ? employmentDetails.past.map(normalizeEmployer) : [];
  const all = Array.isArray(employmentDetails.all)
    ? employmentDetails.all.map(normalizeEmployer)
    : [...current, ...past];
  const name = (basic.name ?? profile.name ?? "Unknown") as string;
  const linkedinUrl = (
    professionalNetworkIdentifier.profile_url ??
    professionalNetwork.profile_url ??
    profile.linkedin_profile_url ??
    null
  ) as string | null;

  return {
    person_id: typeof profile.crustdata_person_id === "number"
      ? profile.crustdata_person_id
      : typeof profile.person_id === "number"
        ? profile.person_id
        : hashString(linkedinUrl || name),
    name,
    first_name: (basic.first_name ?? profile.first_name ?? "") as string,
    last_name: (basic.last_name ?? profile.last_name ?? "") as string,
    headline: (basic.headline ?? profile.headline ?? null) as string | null,
    summary: (basic.summary ?? profile.summary ?? null) as string | null,
    region: (location.full_location ?? basic.location ?? profile.region ?? "") as string,
    profile_picture_url: (basic.profile_picture_url ?? profile.profile_picture_url ?? null) as string | null,
    linkedin_profile_url: linkedinUrl,
    flagship_profile_url: (profile.flagship_profile_url ?? null) as string | null,
    emails: Array.isArray(profile.emails) ? profile.emails as string[] : null,
    twitter_handle: (social.twitter_handle ?? profile.twitter_handle ?? null) as string | null,
    skills: Array.isArray(skills.professional_network_skills) ? skills.professional_network_skills as string[] : null,
    languages: Array.isArray(basic.languages) ? basic.languages as string[] : null,
    num_of_connections: typeof professionalNetwork.connections === "number" ? professionalNetwork.connections : null,
    years_of_experience_raw: typeof profile.years_of_experience_raw === "number" ? profile.years_of_experience_raw : null,
    recently_changed_jobs: typeof profile.recently_changed_jobs === "boolean" ? profile.recently_changed_jobs : null,
    current_employers: current,
    past_employers: past,
    all_employers: all,
    education_background: Array.isArray(education.schools)
      ? education.schools.map((school: unknown) => {
          const item = asRecord(school);
          return {
            degree_name: (item.degree ?? null) as string | null,
            institute_name: (item.school ?? null) as string | null,
            field_of_study: (item.field_of_study ?? null) as string | null,
            start_date: null,
            end_date: null,
          };
        })
      : null,
    certifications: Array.isArray(profile.certifications)
      ? profile.certifications.map((cert: unknown) => {
          const item = asRecord(cert);
          return {
            name: (item.name ?? "") as string,
            issued_date: (item.issue_date ?? null) as string | null,
            issuer_organization: (item.issuing_organization ?? null) as string | null,
          };
        })
      : null,
    location_details: {
      city: (location.city ?? null) as string | null,
      state: (location.state ?? null) as string | null,
      country: (location.country ?? null) as string | null,
      continent: (location.continent ?? null) as string | null,
    },
  };
}

function normalizeCrustDataResponse(raw: unknown): CrustDataResponse {
  const data = asRecord(raw);

  // PersonDB flat shape: { results: [...], total_results, next_cursor }
  if (Array.isArray(data.results)) {
    const results = data.results.map((item: unknown) => {
      const rec = asRecord(item);
      // If already flat (has current_employers at top level), pass through.
      // Otherwise normalize nested enrichment shape.
      if ("current_employers" in rec || "past_employers" in rec) {
        return rec as unknown as CrustDataPerson;
      }
      return normalizeCrustDataPerson(item);
    });
    return {
      total_results: typeof data.total_results === "number" ? data.total_results : results.length,
      next_cursor: (data.next_cursor ?? null) as string | null,
      results,
    };
  }

  const profiles = Array.isArray(data.profiles)
    ? (data.profiles as unknown[]).map((item) => {
        const rec = asRecord(item);
        if ("current_employers" in rec || "past_employers" in rec || "all_employers" in rec) {
          return rec as unknown as CrustDataPerson;
        }
        return normalizeCrustDataPerson(item);
      })
    : [];
  return {
    total_results: typeof data.total_count === "number" ? data.total_count : profiles.length,
    next_cursor: (data.next_cursor ?? null) as string | null,
    results: profiles,
  };
}

export async function runCrustDataPreview(query: CrustDataQuery): Promise<number> {
  // PersonDB requires ONLY `limit` (not `count`). Send a clean minimal body —
  // no `sorts`, no `post_processing`, no inherited fields that could trip validation.
  const previewQuery: Record<string, unknown> = {
    dataset: query.dataset,
    filters: query.filters,
    limit: 1,
  };
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
  const mapped = persons.map(mapCrustDataPerson);
  if (mapped.length > 0) {
    const sample = mapped[0];
    console.log("[CRUSTDATA SAMPLE]", JSON.stringify({
      name: sample.full_name,
      title: sample.job_title,
      company: sample.job_company_name,
      experience_count: sample.experience_history?.length ?? 0,
      education_count: sample.education?.length ?? 0,
      skills_count: sample.skills?.length ?? 0,
      has_headline: !!sample.headline,
      has_summary: !!sample.summary,
    }));
  }
  return mapped;
}

/**
 * Batch-enrich phone numbers for candidates missing them via
 * CrustData Person Enrichment (fields=phone).
 * Cost: 5 credits per profile (3 base + 2 phone addon).
 * Batch limit: 25 LinkedIn URLs per request.
 */
export async function enrichPhoneNumbers(
  linkedinUrls: string[]
): Promise<Map<string, string[]>> {
  const results = new Map<string, string[]>();
  if (linkedinUrls.length === 0) return results;

  const apiKey = Deno.env.get("CRUSTDATA_API_KEY");
  if (!apiKey) return results;

  const BATCH_SIZE = 25;
  const batches: string[][] = [];
  for (let i = 0; i < linkedinUrls.length; i += BATCH_SIZE) {
    batches.push(linkedinUrls.slice(i, i + BATCH_SIZE));
  }

  for (const batch of batches) {
    try {
      const params = new URLSearchParams();
      for (const url of batch) params.append("linkedin_profile_url", url);
      params.append("fields", "personal_contact_info.phone_numbers");

      const res = await fetch(
        `${CRUSTDATA_BASE_URL}/screener/person/enrich?${params.toString()}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!res.ok) {
        console.error(`[CrustData Phone Enrich] Error ${res.status}: ${await res.text()}`);
        continue;
      }

      const data = await res.json();
      const profiles = Array.isArray(data) ? data : [data];

      for (const profile of profiles) {
        const liUrl = profile.linkedin_profile_url;
        const phones = profile.phone_numbers ?? profile.personal_contact_info?.phone_numbers;
        if (liUrl && Array.isArray(phones) && phones.length > 0) {
          results.set(liUrl, phones);
        }
      }
    } catch (err) {
      console.error(`[CrustData Phone Enrich] Failed:`, err instanceof Error ? err.message : String(err));
    }
  }

  console.log(`[CrustData Phone Enrich] Got phones for ${results.size}/${linkedinUrls.length} profiles`);
  return results;
}
