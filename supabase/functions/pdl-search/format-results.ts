// ─── Result Formatter + AI Relevance Summaries ───────────────────────────────

import { CREDENTIAL_PREFIX_REGEX } from "./config.ts";
import type { ParsedFilters } from "./parse-query.ts";

export interface FormattedCandidate {
  id: string;
  full_name: string;
  title: string | null;
  current_employer: string | null;
  location: string | null;
  linkedin_url: string | null;
  email: string | null;
  phone: string | null;
  skills: string[];
  avg_tenure_months: number | null;
  industry: string | null;
  company_size: string | null;
  preview: boolean;
  has_email: boolean;
  has_phone: boolean;
  has_skills: boolean;
  has_experience: boolean;
  match_score: number;
  relevance_summary?: string;
}

export function transformSearchResults(
  pdlData: any,
  filters?: ParsedFilters
): FormattedCandidate[] {
  if (!pdlData?.data) return [];

  return pdlData.data.map((person: any) => {
    const isPreview =
      typeof person.skills === "boolean" ||
      typeof person.experience === "boolean" ||
      typeof person.work_email === "boolean";

    // Skills
    let skills: string[] = [];
    let has_skills = false;
    if (typeof person.skills === "boolean") {
      has_skills = person.skills;
    } else if (Array.isArray(person.skills)) {
      skills = person.skills.slice(0, 10);
      has_skills = skills.length > 0;
    }

    // Email
    let email: string | null = null;
    let has_email = false;
    if (typeof person.work_email === "boolean") {
      has_email = person.work_email;
    } else if (typeof person.personal_emails === "boolean") {
      has_email = person.personal_emails;
    } else {
      email = person.work_email || person.personal_emails?.[0] || null;
      has_email = !!email;
    }

    // Phone
    let phone: string | null = null;
    let has_phone = false;
    if (typeof person.mobile_phone === "boolean") {
      has_phone = person.mobile_phone;
    } else if (typeof person.phone_numbers === "boolean") {
      has_phone = person.phone_numbers;
    } else {
      phone = person.mobile_phone || person.phone_numbers?.[0] || null;
      has_phone = !!phone;
    }

    // Tenure
    let avgTenureMonths: number | null = null;
    let has_experience = false;
    if (typeof person.experience === "boolean") {
      has_experience = person.experience;
    } else if (Array.isArray(person.experience) && person.experience.length > 0) {
      has_experience = true;
      const tenures = person.experience
        .filter((exp: any) => exp.start_date)
        .map((exp: any) => {
          const start = new Date(exp.start_date);
          const end = exp.end_date ? new Date(exp.end_date) : new Date();
          return (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30);
        })
        .filter((t: number) => t > 0 && t < 600);

      if (tenures.length > 0) {
        avgTenureMonths = Math.round(
          tenures.reduce((a: number, b: number) => a + b, 0) / tenures.length
        );
      }
    }

    // Location
    let location: string | null = null;
    const locCity = typeof person.location_locality === "string" ? person.location_locality : null;
    const locRegion = typeof person.location_region === "string" ? person.location_region : null;
    if (locCity || locRegion) {
      location = [locCity, locRegion].filter(Boolean).join(", ");
    } else {
      const compCity = typeof person.job_company_location_locality === "string" ? person.job_company_location_locality : null;
      const compRegion = typeof person.job_company_location_region === "string" ? person.job_company_location_region : null;
      if (compCity || compRegion) {
        location = [compCity, compRegion].filter(Boolean).join(", ");
      }
    }

    // Clean name
    let fullName = person.full_name || "Unknown";
    fullName = fullName.replace(CREDENTIAL_PREFIX_REGEX, "").trim();
    fullName = fullName.replace(/\b\w/g, (c: string) => c.toUpperCase());

    // Match score (0-100)
    const match_score = computeMatchScore(person, filters, {
      has_email, has_phone, has_skills, has_experience,
      location,
    });

    return {
      id: person.id,
      full_name: fullName,
      title: person.job_title || null,
      current_employer: person.job_company_name || null,
      location,
      linkedin_url: person.linkedin_url || null,
      email,
      phone,
      skills,
      avg_tenure_months: avgTenureMonths,
      industry: person.industry || null,
      company_size: typeof person.job_company_size === "boolean" ? null : (person.job_company_size || null),
      preview: isPreview,
      has_email,
      has_phone,
      has_skills,
      has_experience,
      match_score,
    };
  });
}

function computeMatchScore(
  person: any,
  filters: ParsedFilters | undefined,
  meta: { has_email: boolean; has_phone: boolean; has_skills: boolean; has_experience: boolean; location: string | null }
): number {
  let match_score = 50;
  const jobTitle = (person.job_title || "").toLowerCase();
  const personLoc = meta.location?.toLowerCase() || "";

  if (filters) {
    let signals = 0;
    let maxSignals = 0;

    // Title match quality
    const titleTerms = [...(filters.job_titles || []), ...(filters.specialties || [])];
    if (titleTerms.length > 0) {
      maxSignals += 2;
      const exactMatch = titleTerms.some(t => jobTitle === t.toLowerCase());
      const partialMatch = titleTerms.some(t => jobTitle.includes(t.toLowerCase()));
      if (exactMatch) signals += 2;
      else if (partialMatch) signals += 1;
    }

    // Location match quality
    if ((filters.locations || []).length > 0) {
      maxSignals += 2;
      const locMatched = filters.locations.some(l => {
        const ll = l.toLowerCase();
        return personLoc.includes(ll) || ll.split(" ").every(part => personLoc.includes(part));
      });
      if (locMatched) signals += 2;
      else if (personLoc) signals += 1;
    }

    // Company match
    if ((filters.companies || []).length > 0) {
      maxSignals += 1;
      const employer = (person.job_company_name || "").toLowerCase();
      if (filters.companies.some(c => employer.includes(c.toLowerCase()))) signals += 1;
    }

    // Data completeness bonus
    maxSignals += 3;
    if (meta.has_email) signals += 1;
    if (meta.has_phone) signals += 0.5;
    if (meta.has_experience) signals += 0.5;
    if (meta.has_skills) signals += 0.5;
    if (person.linkedin_url) signals += 0.5;

    match_score = maxSignals > 0 ? Math.round((signals / maxSignals) * 100) : 50;
    match_score = Math.max(20, Math.min(99, match_score));
  }

  return match_score;
}

// Generate AI relevance summaries for a batch of candidates
export async function generateRelevanceSummaries(
  candidates: FormattedCandidate[],
  query: string,
  lovableApiKey: string
): Promise<FormattedCandidate[]> {
  if (candidates.length === 0) return candidates;

  try {
    const candidateSummaries = candidates.map((c, i) => 
      `${i + 1}. ${c.full_name} — ${c.title || "Unknown title"} at ${c.current_employer || "Unknown"} in ${c.location || "Unknown"}`
    ).join("\n");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableApiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        temperature: 0.2,
        max_tokens: 1500,
        messages: [
          {
            role: "system",
            content: `You generate one-sentence relevance summaries (max 15 words each) explaining why each candidate matches a healthcare recruiting search. Return ONLY a JSON array of strings, one per candidate, in order. No markdown, no explanation.`,
          },
          {
            role: "user",
            content: `Search query: "${query}"\n\nCandidates:\n${candidateSummaries}`,
          },
        ],
      }),
    });

    if (!res.ok) {
      console.error("AI summary generation failed:", res.status);
      return candidates;
    }

    const data = await res.json();
    let content = data.choices?.[0]?.message?.content?.trim() || "";
    content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    const summaries: string[] = JSON.parse(content);

    return candidates.map((c, i) => ({
      ...c,
      relevance_summary: summaries[i] || undefined,
    }));
  } catch (e) {
    console.error("Failed to generate relevance summaries:", e);
    return candidates; // Return without summaries on failure
  }
}
