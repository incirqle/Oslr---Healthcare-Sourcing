import type { ParsedFilters } from "@/components/search/FilterReview";
import type { Candidate } from "@/components/search/SearchResults";
import { toTitleCase } from "@/components/search/candidate-ui";

export interface MatchChip {
  /** Stable id for keying. */
  id: string;
  /** Short label rendered on the chip. */
  label: string;
  /** Tooltip explaining the specific reason this matched. */
  reason: string;
  /** Origin: which filter group this chip came from. Drives icon choice if needed. */
  group: "company" | "location" | "specialty" | "title" | "experience" | "keyword";
}

const norm = (v: string | null | undefined) => (v ?? "").toLowerCase().trim();

function fuzzyContains(haystack: string, needle: string): boolean {
  const h = norm(haystack);
  const n = norm(needle);
  if (!h || !n) return false;
  if (h.includes(n) || n.includes(h)) return true;
  // Compare first significant token (e.g. "panorama" vs "panorama orthopedics & spine center")
  const firstH = h.split(/[\s,&\-]+/)[0];
  const firstN = n.split(/[\s,&\-]+/)[0];
  return firstH.length >= 4 && firstN.length >= 4 && firstH === firstN;
}

/** Loose synonyms — orthopedics ↔ orthopaedics, etc. Mirrors what reasoning-script does. */
const SYNONYMS: Record<string, string[]> = {
  orthopedics: ["orthopaedics", "orthopedic", "orthopaedic", "musculoskeletal"],
  orthopaedics: ["orthopedics", "orthopedic", "orthopaedic", "musculoskeletal"],
  cardiology: ["cardiac", "cardiovascular"],
  pediatrics: ["pediatric", "paediatric", "paediatrics"],
  obstetrics: ["ob", "ob/gyn", "gynecology"],
  oncology: ["cancer", "hematology"],
  neurology: ["neurological", "neuro"],
};

function specialtyMatches(text: string, term: string): boolean {
  const t = norm(text);
  const k = norm(term);
  if (!t || !k) return false;
  if (t.includes(k) || k.includes(t)) return true;
  const synonyms = SYNONYMS[k] ?? [];
  return synonyms.some((s) => t.includes(s));
}

/**
 * Build the 2–4 match chips for a candidate, derived from the user's parsed filters.
 * Returns an empty array if fewer than 1 strong match — never pads with filler.
 */
export function buildMatchChips(candidate: Candidate, filters: ParsedFilters): MatchChip[] {
  const chips: MatchChip[] = [];

  // Company match — current employer
  for (const company of filters.companies ?? []) {
    if (candidate.current_employer && fuzzyContains(candidate.current_employer, company)) {
      chips.push({
        id: `company-${company}`,
        label: toTitleCase(candidate.current_employer),
        reason: `Currently employed at ${toTitleCase(candidate.current_employer)}.`,
        group: "company",
      });
      break;
    }
  }

  // Location match
  for (const loc of filters.locations ?? []) {
    if (candidate.location && fuzzyContains(candidate.location, loc)) {
      chips.push({
        id: `loc-${loc}`,
        label: toTitleCase(loc),
        reason: `Based in ${toTitleCase(candidate.location)}, which matches your location filter.`,
        group: "location",
      });
      break;
    }
  }

  // Specialty match — check title, skills, clinical_skills
  const haystack = [
    candidate.title ?? "",
    ...(candidate.skills ?? []),
    ...(candidate.clinical_skills ?? []),
    candidate.industry ?? "",
  ].join(" ");
  for (const specialty of filters.specialties ?? []) {
    if (specialtyMatches(haystack, specialty)) {
      chips.push({
        id: `spec-${specialty}`,
        label: toTitleCase(specialty),
        reason: `Profile mentions ${toTitleCase(specialty)} or a related specialty.`,
        group: "specialty",
      });
      break;
    }
  }

  // Title / role match
  for (const title of filters.job_titles ?? []) {
    if (candidate.title && fuzzyContains(candidate.title, title)) {
      chips.push({
        id: `title-${title}`,
        label: toTitleCase(title),
        reason: `Current title matches "${toTitleCase(title)}".`,
        group: "title",
      });
      break;
    }
  }

  // Experience years — only if a real number is present and candidate clears the bar
  if (filters.experience_years && candidate.years_experience && candidate.years_experience >= filters.experience_years) {
    chips.push({
      id: `exp-${filters.experience_years}`,
      label: `${candidate.years_experience}y experience`,
      reason: `${candidate.years_experience} years of experience meets your ${filters.experience_years}+ year filter.`,
      group: "experience",
    });
  }

  return chips.slice(0, 4);
}

/**
 * Returns true when the user's query specifically targets a single company
 * (i.e. the company chip on every result row would be redundant).
 */
export function queryIsCompanySpecific(filters: ParsedFilters): boolean {
  return (filters.companies ?? []).length > 0;
}
