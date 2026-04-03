/**
 * format-results.ts — PDL record → formatted clinical candidate mapping.
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
  skills: string[];
  experience: Record<string, unknown>[];
  education: Record<string, unknown>[];
  certifications: string[];
  inferred_years_experience: number | null;
  gender: string | null;
  emails: string[];
  phone_numbers: string[];
  profiles: Record<string, unknown>[];
}

export function mapPerson(raw: Record<string, unknown>): FormattedCandidate {
  return {
    id: (raw.id as string) || crypto.randomUUID(),
    full_name: (raw.full_name as string) || "",
    first_name: (raw.first_name as string) || "",
    last_name: (raw.last_name as string) || "",
    job_title: (raw.job_title as string) || "",
    job_company_name: (raw.job_company_name as string) || "",
    job_company_industry: (raw.job_company_industry as string) || "",
    linkedin_url: (raw.linkedin_url as string) || null,
    location_name: (raw.location_name as string) || "",
    location_locality: (raw.location_locality as string) || "",
    location_region: (raw.location_region as string) || "",
    location_country: (raw.location_country as string) || "",
    headline: (raw.headline as string) || "",
    summary: (raw.summary as string) || "",
    skills: Array.isArray(raw.skills) ? raw.skills.map((s: unknown) => typeof s === "string" ? s : String(s)) : [],
    experience: Array.isArray(raw.experience) ? raw.experience as Record<string, unknown>[] : [],
    education: Array.isArray(raw.education) ? raw.education as Record<string, unknown>[] : [],
    certifications: Array.isArray(raw.certifications) ? raw.certifications.map((c: unknown) => typeof c === "string" ? c : String(c)) : [],
    inferred_years_experience: typeof raw.inferred_years_experience === "number" ? raw.inferred_years_experience : null,
    gender: (raw.gender as string) || null,
    emails: Array.isArray(raw.emails) ? raw.emails.filter((e: unknown) => typeof e === "string") as string[] : [],
    phone_numbers: Array.isArray(raw.phone_numbers) ? raw.phone_numbers.filter((p: unknown) => typeof p === "string") as string[] : [],
    profiles: Array.isArray(raw.profiles) ? raw.profiles as Record<string, unknown>[] : [],
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
