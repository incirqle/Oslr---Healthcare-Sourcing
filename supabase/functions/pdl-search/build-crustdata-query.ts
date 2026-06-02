/**
 * build-crustdata-query.ts — Converts parsed search intent into CrustData PersonDB filter objects.
 *
 * CRITICAL: CrustData filter shape is strict.
 * - filters: [ { type: "AND", value: [...] } ]  — exactly one top-level wrapper
 * - Each element in value[] is either:
 *   - Basic: { filter_type, type, value }
 *   - Compound: { type: "AND"|"OR", value: [...] }
 * - Never mix filter_type with type:"AND"|"OR" on the same object
 */

import {
  HEALTH_SYSTEM_DIVISIONS,
  COMPANY_ALIASES,
  TITLE_EXPANSIONS,
  US_STATES,
} from "./config.ts";

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */

interface BasicFilter {
  filter_type: string;
  type: string;
  value: unknown;
}

interface CompoundFilter {
  type: "AND" | "OR";
  value: Array<BasicFilter | CompoundFilter>;
}

type CrustFilter = BasicFilter | CompoundFilter;

interface CrustDataQuery {
  dataset: "people";
  filters: [CompoundFilter]; // EXACTLY one top-level AND/OR
  sorts?: { column: string; order: "asc" | "desc" }[];
  count: number;
  preview: boolean;
  post_processing?: { exclude_profiles?: string[] };
}

interface BuildCrustDataOptions {
  size?: number;
  preview?: boolean;
  excludeLinkedInUrls?: string[];
}

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

const ABBREV_TO_STATE: Record<string, string> = {};
for (const [full, abbr] of Object.entries(US_STATES)) {
  ABBREV_TO_STATE[abbr.toLowerCase()] = full;
}

function normalizeStateName(s: string): string {
  const lower = s.toLowerCase().trim();
  return ABBREV_TO_STATE[lower] ?? lower;
}

function expandCompanyNames(company: string): string[] {
  const lower = company.toLowerCase().trim();
  const canonical = COMPANY_ALIASES[lower] ?? lower;
  const divisions = HEALTH_SYSTEM_DIVISIONS[canonical] ?? [];
  const all = new Set([canonical, lower, ...divisions]);
  return Array.from(all);
}

function buildTitleTerms(
  jobTitles: string[],
  specialty: string | null,
  titleSynonyms?: string[]
): string[] {
  const terms = new Set<string>();
  for (const title of jobTitles) {
    terms.add(title);
    const expansions = TITLE_EXPANSIONS[title.toLowerCase()];
    if (expansions) {
      for (const exp of expansions) terms.add(exp);
    }
  }
  if (titleSynonyms) {
    for (const syn of titleSynonyms) terms.add(syn);
  }
  if (specialty && jobTitles.length > 0) {
    for (const title of jobTitles) {
      terms.add(`${specialty} ${title}`);
    }
  }
  return Array.from(terms).filter(Boolean);
}

/* ------------------------------------------------------------------ */
/* Coordinate maps for geo_distance                                     */
/* ------------------------------------------------------------------ */

const STATE_CENTER_COORDS: Record<string, [number, number]> = {
  "colorado": [39.5501, -105.7821],
  "california": [36.7783, -119.4179],
  "texas": [31.9686, -99.9018],
  "new york": [40.7128, -74.0060],
  "florida": [27.6648, -81.5158],
  "illinois": [40.6331, -89.3985],
  "pennsylvania": [41.2033, -77.1945],
  "ohio": [40.4173, -82.9071],
  "georgia": [32.1656, -83.4750],
  "north carolina": [35.7596, -79.0193],
  "michigan": [44.3148, -85.6024],
  "massachusetts": [42.4072, -71.3824],
  "arizona": [34.0489, -111.0937],
  "washington": [47.7511, -120.7401],
  "tennessee": [35.5175, -86.5804],
  "minnesota": [46.7296, -94.6859],
  "missouri": [37.9643, -91.8318],
  "maryland": [39.0458, -76.6413],
  "wisconsin": [43.7844, -88.7879],
  "indiana": [40.2672, -86.1349],
};

const CITY_COORDS: Record<string, [number, number]> = {
  "denver": [39.7392, -104.9903],
  "colorado springs": [38.8339, -104.8214],
  "aurora": [39.7294, -104.8319],
  "fort collins": [40.5853, -105.0844],
  "boulder": [40.0150, -105.2705],
  "dallas": [32.7767, -96.7970],
  "houston": [29.7604, -95.3698],
  "austin": [30.2672, -97.7431],
  "san antonio": [29.4241, -98.4936],
  "new york": [40.7128, -74.0060],
  "los angeles": [34.0522, -118.2437],
  "chicago": [41.8781, -87.6298],
  "phoenix": [33.4484, -112.0740],
  "philadelphia": [39.9526, -75.1652],
  "san francisco": [37.7749, -122.4194],
  "seattle": [47.6062, -122.3321],
  "boston": [42.3601, -71.0589],
  "atlanta": [33.7490, -84.3880],
  "miami": [25.7617, -80.1918],
  "minneapolis": [44.9778, -93.2650],
  "cleveland": [41.4993, -81.6944],
  "rochester": [44.0121, -92.4802],
  "pittsburgh": [40.4406, -79.9959],
  "nashville": [36.1627, -86.7816],
  "charlotte": [35.2271, -80.8431],
  "portland": [45.5152, -122.6784],
  "san diego": [32.7157, -117.1611],
  "tampa": [27.9506, -82.4572],
  "st. louis": [38.6270, -90.1994],
  "salt lake city": [40.7608, -111.8910],
  "jacksonville": [30.3322, -81.6557],
  "indianapolis": [39.7684, -86.1581],
  "columbus": [39.9612, -82.9988],
  "detroit": [42.3314, -83.0458],
  "milwaukee": [43.0389, -87.9065],
  "kansas city": [39.0997, -94.5786],
  "baltimore": [39.2904, -76.6122],
};

/* ------------------------------------------------------------------ */
/* Main query builder                                                    */
/* ------------------------------------------------------------------ */

export function buildCrustDataQuery(
  parsed: Record<string, unknown>,
  options: BuildCrustDataOptions = {}
): CrustDataQuery {
  const { size = 100, preview = false, excludeLinkedInUrls } = options;

  // Collect all AND conditions — each is either a BasicFilter or a CompoundFilter
  const andConditions: CrustFilter[] = [];

  // ── 1. TITLE MATCHING ─────────────────────────────────────────────
  const jobTitles = (parsed.job_titles as string[]) || [];
  const titleSynonyms = (parsed.title_synonyms as string[]) || [];
  const specialty = (parsed.specialty as string) || null;
  const specialties = (parsed.specialties as string[]) || [];
  const effectiveSpecialty = specialty || specialties[0] || null;

  const titleTerms = buildTitleTerms(jobTitles, effectiveSpecialty, titleSynonyms);

  if (titleTerms.length > 0) {
    const titleBasicFilters: BasicFilter[] = titleTerms.slice(0, 10).map(term => ({
      filter_type: "current_employers.title",
      type: "(.)",
      value: term,
    }));

    if (titleBasicFilters.length === 1) {
      andConditions.push(titleBasicFilters[0]);
    } else {
      // Wrap multiple title options in an OR compound filter
      const orBlock: CompoundFilter = {
        type: "OR",
        value: titleBasicFilters,
      };
      andConditions.push(orBlock);
    }
  }

  // ── 2. SPECIALTY via HEADLINE (when no title terms) ───────────────
  if (effectiveSpecialty && titleTerms.length === 0) {
    andConditions.push({
      filter_type: "headline",
      type: "(.)",
      value: effectiveSpecialty,
    });
  }

  // ── 3. COMPANY MATCHING ───────────────────────────────────────────
  const currentCompanies = (parsed.current_companies as string[]) || [];
  const companies = (parsed.companies as string[]) || [];
  const effectiveCompanies = currentCompanies.length > 0 ? currentCompanies : companies;

  if (effectiveCompanies.length > 0) {
    const companyBasicFilters: BasicFilter[] = [];

    for (const company of effectiveCompanies) {
      const variants = expandCompanyNames(company);
      for (const variant of variants.slice(0, 5)) {
        companyBasicFilters.push({
          filter_type: "current_employers.name",
          type: "(.)",
          value: variant,
        });
      }
    }

    if (companyBasicFilters.length === 1) {
      andConditions.push(companyBasicFilters[0]);
    } else if (companyBasicFilters.length > 1) {
      const orBlock: CompoundFilter = {
        type: "OR",
        value: companyBasicFilters,
      };
      andConditions.push(orBlock);
    }
  }

  // Past companies
  const pastCompanies = (parsed.past_companies as string[]) || (parsed.previous_companies as string[]) || [];
  if (pastCompanies.length > 0) {
    const pastBasicFilters: BasicFilter[] = [];
    for (const company of pastCompanies) {
      const variants = expandCompanyNames(company);
      for (const variant of variants.slice(0, 3)) {
        pastBasicFilters.push({
          filter_type: "past_employers.name",
          type: "(.)",
          value: variant,
        });
      }
    }
    if (pastBasicFilters.length === 1) {
      andConditions.push(pastBasicFilters[0]);
    } else if (pastBasicFilters.length > 1) {
      const orBlock: CompoundFilter = {
        type: "OR",
        value: pastBasicFilters,
      };
      andConditions.push(orBlock);
    }
  }

  // ── 4. LOCATION ───────────────────────────────────────────────────
  const locationObj = (parsed.location as { city?: string | null; state?: string | null; metro?: string | null }) || {};

  if (locationObj.city) {
    const cityLower = locationObj.city.toLowerCase().trim();
    const coords = CITY_COORDS[cityLower];
    if (coords) {
      andConditions.push({
        filter_type: "location",
        type: "geo_distance",
        value: { lat_lng: coords, distance: 50, unit: "km" },
      });
    } else {
      andConditions.push({
        filter_type: "location",
        type: "geo_distance",
        value: { location: locationObj.city, distance: 50, unit: "km" },
      });
    }
  } else if (locationObj.state) {
    const stateLower = normalizeStateName(locationObj.state);
    const coords = STATE_CENTER_COORDS[stateLower];
    if (coords) {
      andConditions.push({
        filter_type: "location",
        type: "geo_distance",
        value: { lat_lng: coords, distance: 200, unit: "km" },
      });
    } else {
      andConditions.push({
        filter_type: "location_details.state",
        type: "=",
        value: stateLower,
      });
    }
  }

  // ── 5. CREDENTIALS in HEADLINE ────────────────────────────────────
  const credentials = (parsed.credentials as string[]) || [];
  if (credentials.length > 0) {
    const credBasicFilters: BasicFilter[] = credentials.slice(0, 5).map(cred => ({
      filter_type: "headline",
      type: "(.)",
      value: cred,
    }));
    if (credBasicFilters.length === 1) {
      andConditions.push(credBasicFilters[0]);
    } else {
      const orBlock: CompoundFilter = {
        type: "OR",
        value: credBasicFilters,
      };
      andConditions.push(orBlock);
    }
  }

  // ── 6. SKILLS (fallback when no title/specialty) ──────────────────
  const keywords = (parsed.keywords as string[]) || (parsed.required_keywords as string[]) || [];
  if (keywords.length > 0 && titleTerms.length === 0 && !effectiveSpecialty) {
    const skillBasicFilters: BasicFilter[] = keywords.slice(0, 5).map(kw => ({
      filter_type: "skills",
      type: "(.)",
      value: kw,
    }));
    if (skillBasicFilters.length === 1) {
      andConditions.push(skillBasicFilters[0]);
    } else {
      const orBlock: CompoundFilter = {
        type: "OR",
        value: skillBasicFilters,
      };
      andConditions.push(orBlock);
    }
  }

  // ── 7. COUNTRY (always US) ────────────────────────────────────────
  andConditions.push({
    filter_type: "location_details.country",
    type: "=",
    value: "United States",
  });

  // ── BUILD FINAL QUERY ─────────────────────────────────────────────
  // CrustData expects: filters: [ ONE top-level AND/OR wrapper ]
  const topLevelFilter: CompoundFilter = {
    type: "AND",
    value: andConditions,
  };

  const query: CrustDataQuery = {
    dataset: "people",
    filters: [topLevelFilter],
    count: Math.min(size, 1000),
    preview,
  };

  if (!preview) {
    query.sorts = [{ column: "years_of_experience_raw", order: "desc" }];
  }

  if (excludeLinkedInUrls && excludeLinkedInUrls.length > 0) {
    query.post_processing = {
      exclude_profiles: excludeLinkedInUrls.slice(0, 50000),
    };
  }

  return query;
}

export type CrustCascadeStep =
  | "drop_titles"
  | "expand_geo"
  | "drop_company"
  | "headline_only";

export function applyCascadeStep(
  query: CrustDataQuery,
  step: CrustCascadeStep
): CrustDataQuery {
  const cloned: CrustDataQuery = JSON.parse(JSON.stringify(query));
  const andBlock = cloned.filters[0];

  switch (step) {
    case "drop_titles": {
      andBlock.value = andBlock.value.filter(f => {
        if ("filter_type" in f && f.filter_type === "current_employers.title") return false;
        if (!("filter_type" in f) && f.type === "OR") {
          return !f.value.some(
            i => "filter_type" in i && i.filter_type === "current_employers.title"
          );
        }
        return true;
      });
      break;
    }
    case "expand_geo": {
      for (const filter of andBlock.value) {
        if ("filter_type" in filter && filter.filter_type === "location" && filter.type === "geo_distance") {
          const val = filter.value as { distance: number; [k: string]: unknown };
          val.distance = Math.min(val.distance * 2, 500);
        }
      }
      break;
    }
    case "drop_company": {
      andBlock.value = andBlock.value.filter(f => {
        if ("filter_type" in f && f.filter_type.includes("employers.name")) return false;
        if (!("filter_type" in f) && f.type === "OR") {
          return !f.value.some(
            i => "filter_type" in i && i.filter_type.includes("employers.name")
          );
        }
        return true;
      });
      break;
    }
    case "headline_only": {
      andBlock.value = andBlock.value.filter(f => {
        if ("filter_type" in f) {
          const ft = f.filter_type;
          return (
            ft === "headline" ||
            ft === "location" ||
            ft === "location_details.country" ||
            ft === "location_details.state"
          );
        }
        return false;
      });
      break;
    }
  }

  return cloned;
}

export type { CrustDataQuery, CrustFilter, BasicFilter, CompoundFilter, BuildCrustDataOptions };
