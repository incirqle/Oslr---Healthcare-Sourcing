/**
 * format-results.ts — PDL record → formatted clinical candidate mapping.
 * ENHANCED: Added salary, profile photo, experience history, education details,
 * and additional metadata fields for the rich UI.
 */

export interface FormattedCandidate {
  id: string;
  full_name: string;
  first_name: string;
  last_name: string;
  job_title: string;
  job_company_name: string;
  job_company_industry: string;
  linkedin_url: string | null;
  location_name: string;
  location_locality: string;
  location_region: string;
  location_country: string;
  headline: string;
  summary: string;
  job_summary: string;
  skills: string[];
  clinical_skills: string[];
  all_skills: string[];
  experience: Record<string, unknown>[];
  experience_history: {
    company_name: string | null;
    title: string | null;
    start_date: string | null;
    end_date: string | null;
    is_primary: boolean;
    company_industry: string | null;
    company_size: string | null;
    location: string | null;
  }[];
  education: {
    school_name: string | null;
    degrees: string[];
    majors: string[];
    start_date: string | null;
    end_date: string | null;
  }[];
  certifications: string[];
  inferred_years_experience: number | null;
  years_experience: number;
  gender: string | null;
  emails: string[];
  email: string | null;
  phone: string | null;
  mobile_phone: string | null;
  phone_numbers: string[];
  has_contact_info: boolean;
  profiles: Record<string, unknown>[];
  // NEW fields for V2 UI
  inferred_salary: string | null;
  job_title_sub_role: string | null;
  job_title_role: string | null;
  job_start_date: string | null;
  job_company_size: string | null;
  job_company_location_name: string | null;
  job_company_location_locality: string | null;
  job_company_location_region: string | null;
  profile_pic_url: string | null;
  github_url: string | null;
  facebook_url: string | null;
  twitter_url: string | null;
  sex: string | null;
  birth_year: number | null;
  industry: string | null;
  interests: string[];
  job_title_levels: string[];
  job_onet_broad_occupation: string | null;
  job_onet_specific_occupation: string | null;
  relevance_score: number;
}

function safeString(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
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

export function mapPerson(raw: Record<string, unknown>): FormattedCandidate {
  const p = raw as Record<string, unknown>;

  // Extract skills
  const skills = Array.isArray(p.skills) ? p.skills.map((s: unknown) => typeof s === "string" ? s : String(s)) : [];
  const clinicalSkills = skills.filter(isClinicalSkill);

  // Extract emails
  const rawEmails = Array.isArray(p.emails) ? p.emails : [];
  const emails: { address: string }[] = rawEmails
    .map((e: unknown) => {
      if (typeof e === "string") return { address: e };
      if (e && typeof e === "object" && "address" in (e as Record<string, unknown>)) return { address: (e as Record<string, unknown>).address as string };
      return null;
    })
    .filter(Boolean) as { address: string }[];

  // Extract phones
  const rawPhones = Array.isArray(p.phone_numbers) ? p.phone_numbers : [];
  const phones = rawPhones.filter((ph: unknown) => typeof ph === "string") as string[];

  // Extract experience history
  const rawExperience = Array.isArray(p.experience) ? p.experience as Record<string, unknown>[] : [];
  const experienceHistory = rawExperience.map((exp: Record<string, unknown>) => {
    const company = exp.company as Record<string, unknown> | null;
    const title = exp.title as Record<string, unknown> | null;
    return {
      company_name: safeString(company?.name),
      title: safeString(title?.name),
      start_date: safeString(exp.start_date),
      end_date: safeString(exp.end_date),
      is_primary: exp.is_primary === true,
      company_industry: safeString(company?.industry),
      company_size: safeString(company?.size),
      location: Array.isArray(exp.location_names) && exp.location_names.length > 0 ? exp.location_names[0] as string : null,
    };
  });

  // Extract education
  const rawEducation = Array.isArray(p.education) ? p.education as Record<string, unknown>[] : [];
  const education = rawEducation.map((edu: Record<string, unknown>) => {
    const school = edu.school as Record<string, unknown> | null;
    return {
      school_name: safeString(school?.name),
      degrees: Array.isArray(edu.degrees) ? edu.degrees.map((d: unknown) => typeof d === "string" ? d : String(d)) : [],
      majors: Array.isArray(edu.majors) ? edu.majors.map((m: unknown) => typeof m === "string" ? m : String(m)) : [],
      start_date: safeString(edu.start_date),
      end_date: safeString(edu.end_date),
    };
  });

  // Years of experience
  const yearsExp = typeof p.inferred_years_experience === "number" ? p.inferred_years_experience : 0;

  return {
    id: (p.id as string) || crypto.randomUUID(),
    full_name: (p.full_name as string) || "",
    first_name: (p.first_name as string) || "",
    last_name: (p.last_name as string) || "",
    job_title: safeString(p.job_title) || "",
    job_company_name: safeString(p.job_company_name) || "",
    job_company_industry: safeString(p.job_company_industry) || "",
    linkedin_url: safeString(p.linkedin_url),
    location_name: safeString(p.location_name) || "",
    location_locality: safeString(p.location_locality) || "",
    location_region: safeString(p.location_region) || "",
    location_country: safeString(p.location_country) || "",
    headline: safeString(p.headline) || "",
    summary: safeString(p.summary) || "",
    job_summary: safeString(p.job_summary) || "",
    skills: clinicalSkills.slice(0, 10),
    clinical_skills: clinicalSkills.slice(0, 10),
    all_skills: skills,
    experience: rawExperience,
    experience_history: experienceHistory,
    education,
    certifications: Array.isArray(p.certifications) ? p.certifications.map((c: unknown) => typeof c === "string" ? c : String(c)) : [],
    inferred_years_experience: typeof p.inferred_years_experience === "number" ? p.inferred_years_experience : null,
    years_experience: yearsExp,
    gender: safeString(p.gender),
    emails: emails.map(e => e.address),
    email: emails.length > 0 ? emails[0].address : null,
    phone: phones.length > 0 ? phones[0] : null,
    mobile_phone: typeof p.mobile_phone === "string" ? p.mobile_phone : null,
    has_contact_info: emails.length > 0 || phones.length > 0,
    phone_numbers: phones,
    profiles: Array.isArray(p.profiles) ? p.profiles as Record<string, unknown>[] : [],
    // NEW V2 fields
    inferred_salary: safeString(p.inferred_salary),
    job_title_sub_role: safeString(p.job_title_sub_role),
    job_title_role: safeString(p.job_title_role),
    job_start_date: safeString(p.job_start_date),
    job_company_size: safeString(p.job_company_size),
    job_company_location_name: safeString(p.job_company_location_name),
    profile_pic_url: safeString(p.profile_pic_url) || safeString((p as Record<string, unknown>).facebook_profile_pic_url),
    github_url: safeString(p.github_url),
    facebook_url: safeString(p.facebook_url),
    twitter_url: safeString(p.twitter_url),
    sex: safeString(p.sex),
    birth_year: typeof p.birth_year === "number" ? p.birth_year : null,
    industry: safeString(p.industry),
    interests: Array.isArray(p.interests) ? p.interests : [],
    job_title_levels: Array.isArray(p.job_title_levels) ? p.job_title_levels : [],
    job_onet_broad_occupation: safeString(p.job_onet_broad_occupation),
    job_onet_specific_occupation: safeString(p.job_onet_specific_occupation),
    relevance_score: 50, // default; overwritten by scoreAndRankResults
  };
}

export function deriveParsedCategories(
  parsed: Record<string, unknown>,
  filters: Record<string, unknown>
): string[] {
  const cats: string[] = [];
  const titles = (parsed.job_titles as string[]) || (filters.job_titles as string[]) || [];
  const specs = (parsed.specialties as string[]) || (filters.specialties as string[]) || [];
  const locations = (parsed.locations as { state?: string; city?: string }[]) || [];
  const l2Loc = parsed.location as { state?: string | null; city?: string | null } | undefined;

  if (titles.length > 0) cats.push("role");
  if (specs.length > 0) cats.push("specialty");
  if (locations.length > 0 || l2Loc?.state || l2Loc?.city) cats.push("location");
  if ((parsed.current_companies as string[])?.length > 0 || (filters.companies as string[])?.length > 0) cats.push("employer");
  if ((parsed.credentials as string[])?.length > 0) cats.push("credentials");

  return cats;
}

export function deriveParsedKeywords(
  parsed: Record<string, unknown>,
  filters: Record<string, unknown>
): Record<string, string[]> {
  return {
    titles: (parsed.job_titles as string[]) || [],
    specialties: (parsed.specialties as string[]) || (filters.specialties as string[]) || [],
    keywords: (parsed.required_keywords as string[]) || [],
    credentials: (parsed.credentials as string[]) || [],
    employers: (parsed.current_companies as string[]) || [],
  };
}

export function scoreAndRankResults(
  candidates: FormattedCandidate[],
  parsed: Record<string, unknown>,
): FormattedCandidate[] {
  const queryTitles = ((parsed.job_titles as string[]) || []).map(t => t.toLowerCase());
  const querySpecialties = ((parsed.specialties as string[]) || []).map(s => s.toLowerCase());
  const queryCompanies = ((parsed.current_companies as string[]) || []).map(c => c.toLowerCase());

  const wantsDoc = queryTitles.some(t => /\b(physician|doctor|surgeon|hospitalist|md)\b/.test(t))
                && !queryTitles.some(t => /\bphysician assistant\b/.test(t));
  const wantsPa  = queryTitles.some(t => /\bphysician assistant\b|\bpa-?c\b/.test(t));
  const wantsNurse = queryTitles.some(t => /\b(nurse|rn|lpn|cna|crna|aprn)\b/.test(t))
                  && !queryTitles.some(t => /\bnurse practitioner\b/.test(t));

  return candidates.map(person => {
    let score = 50;
    const jobTitle = (person.job_title || "").toLowerCase();
    const subRole = (person.job_title_sub_role || "").toLowerCase();
    const onetBroad = (person.job_onet_broad_occupation || "").toLowerCase();
    const onetSpecific = (person.job_onet_specific_occupation || "").toLowerCase();

    // Title match
    for (const qt of queryTitles) {
      if (jobTitle.includes(qt)) { score += 8; break; }
    }

    // Specialty match
    for (const qs of querySpecialties) {
      if (jobTitle.includes(qs) || (person.all_skills || []).some(s => s.toLowerCase().includes(qs))) {
        score += 5; break;
      }
    }

    // Company match
    for (const qc of queryCompanies) {
      if ((person.job_company_name || "").toLowerCase().includes(qc)) { score += 5; break; }
    }

    // O*NET and sub-role scoring
    if (wantsDoc) {
      if (onetBroad === "physician assistants" || onetSpecific === "physician assistants") score -= 100;
      if (onetBroad === "registered nurses" || onetSpecific === "registered nurses") score -= 100;
      if (onetSpecific === "nurse practitioners" || onetSpecific === "nurse anesthetists") score -= 100;

      const nonDoctor = /(physician assistant|pa-?c|nurse practitioner|registered nurse|medical assistant|medical scribe|technician|technologist|hygienist|phlebotomist)/i;
      if (nonDoctor.test(jobTitle)) score -= 60;

      if (onetBroad === "physicians" || onetBroad === "surgeons") score += 20;
      if (onetSpecific.includes("physician") && !onetSpecific.includes("assistant")) score += 15;
      if (subRole === "doctor") score += 10;

      if (/\b(physician|surgeon|hospitalist|cardiologist|oncologist|pediatrician|radiologist|anesthesiologist|psychiatrist|neurologist)\b/i.test(jobTitle)
          && !/\bassistant\b/i.test(jobTitle)) score += 15;
      if (/, md\b|, do\b|^dr\.?\s/i.test(jobTitle)) score += 10;
    }
    if (wantsPa) {
      if (onetBroad === "physician assistants" || onetSpecific === "physician assistants") score += 20;
      if (/physician assistant|pa-?c/i.test(jobTitle)) score += 15;
    }
    if (wantsNurse) {
      if (subRole === "nursing") score += 10;
      if (onetBroad === "registered nurses") score += 15;
    }

    return { ...person, relevance_score: Math.max(0, Math.min(100, score)) };
  }).sort((a, b) => b.relevance_score - a.relevance_score);
}
