/**
 * build-pdl-query.ts — Elasticsearch DSL query builder for clinical healthcare.
 *
 * CRITICAL CHANGE FROM OLD OSLR: SQL → Elasticsearch DSL
 * Uses bool query with filter/must/should/must_not layers.
 *
 * Architecture:
 * - filter = HARD constraints (location, country, industry, experience, role)
 * - must = required signal groups (person name, current employer, specialty keywords)
 * - should = soft scoring boosts (title variants, known specialty employers)
 * - must_not = exclusions (non-healthcare industries)
 *
 * KEY FIXES (April 2026):
 * 1. Use job_title_sub_role (canonical: "doctor","nursing","dental","pharmacy","therapy")
 *    instead of broad job_title_role: "health" + fragile blacklist.
 * 2. Use "job_title.text" for full-text search (match/match_phrase).
 *    job_title is a keyword field — match on it silently fails.
 * 3. Company always in must when user specifies one — never softShould.
 * 4. Use term on keyword fields (job_company_name, experience.company.name, full_name).
 */

import {
  HEALTH_SYSTEM_DIVISIONS,
  COMPANY_ALIASES,
  SPECIALTY_EMPLOYERS,
  HEALTHCARE_INDUSTRIES,
  EXCLUDED_INDUSTRIES,
  TITLE_EXPANSIONS,
  CITY_TO_METRO,
  NEARBY_CITIES,
  US_STATES,
} from "./config.ts";

/* ------------------------------------------------------------------ */
/* State abbreviation → full name reverse lookup                       */
/* ------------------------------------------------------------------ */
const ABBREV_TO_STATE: Record<string, string> = {};
for (const [full, abbr] of Object.entries(US_STATES)) {
  ABBREV_TO_STATE[abbr.toLowerCase()] = full;
}

function normalizeState(s: string): string {
  const lower = s.toLowerCase().trim();
  return ABBREV_TO_STATE[lower] ?? lower;
}

/* ------------------------------------------------------------------ */
/* Nearby cities helper                                                 */
/* ------------------------------------------------------------------ */

function getNearbyCities(city: string, radiusMiles: number): string[] {
  const tiers = NEARBY_CITIES[city.toLowerCase()];
  if (!tiers) return [];
  const result: string[] = [];
  for (const tier of tiers) {
    if (tier.radius <= radiusMiles) result.push(...tier.cities);
  }
  return [...new Set(result)];
}

/* ------------------------------------------------------------------ */
/* Company variant expansion                                            */
/* ------------------------------------------------------------------ */

function normalizeCompany(name: string): string {
  const lower = name.toLowerCase().trim();
  return COMPANY_ALIASES[lower] ?? lower;
}

function getCompanyVariants(company: string): string[] {
  const lower = company.toLowerCase();
  const variants = [lower];
  for (const [parent, divisions] of Object.entries(HEALTH_SYSTEM_DIVISIONS)) {
    if (lower === parent || lower.includes(parent) || parent.includes(lower)) {
      variants.push(parent, ...divisions);
    }
    for (const div of divisions) {
      if (lower === div || lower.includes(div) || div.includes(lower)) {
        variants.push(parent, ...divisions);
      }
    }
  }
  return [...new Set(variants)];
}

/* ------------------------------------------------------------------ */
/* Title variant expansion                                              */
/* ------------------------------------------------------------------ */

function expandTitleVariants(titles: string[]): string[] {
  const expanded = new Set<string>();
  for (const t of titles) {
    const lower = t.toLowerCase();
    expanded.add(lower);
    for (const [key, variants] of Object.entries(TITLE_EXPANSIONS)) {
      if (lower === key || lower.includes(key) || key.includes(lower)) {
        for (const v of variants) expanded.add(v);
      }
    }
  }
  return [...expanded];
}

/* ------------------------------------------------------------------ */
/* Sub-role detection — maps search intent to PDL canonical values      */
/* ------------------------------------------------------------------ */

const SUB_ROLE_TERMS: Record<string, string[]> = {
  doctor: ["physician", "doctor", "md", "do", "surgeon", "attending", "hospitalist", "cardiologist", "radiologist", "anesthesiologist", "pathologist", "dermatologist", "neurologist", "urologist", "oncologist", "gastroenterologist", "pulmonologist", "nephrologist", "endocrinologist", "rheumatologist", "ophthalmologist", "psychiatrist", "pediatrician", "internist", "intensivist", "neonatologist", "obstetrician", "gynecologist"],
  nursing: ["nurse", "rn", "lpn", "lvn", "cna", "nursing", "nurse practitioner", "np", "aprn", "fnp", "crna", "nurse anesthetist", "charge nurse", "staff nurse"],
  dental: ["dentist", "dental", "hygienist", "dds", "dmd", "orthodontist", "periodontist", "endodontist"],
  pharmacy: ["pharmacist", "pharmacy", "pharmd"],
  therapy: ["therapist", "pt", "ot", "slp", "rt", "dpt", "physical therapist", "occupational therapist", "speech therapist", "respiratory therapist"],
};

function detectSubRoles(titles: string[], keywords: string[]): string[] {
  const allTerms = [...titles, ...keywords].map(t => t.toLowerCase());
  const matched = new Set<string>();

  for (const [subRole, terms] of Object.entries(SUB_ROLE_TERMS)) {
    for (const searchTerm of allTerms) {
      if (terms.some(t => {
        // For short terms (<=3 chars like "rn", "pt", "ot", "rt", "np", "do", "md"),
        // require exact word match to avoid false positives (e.g. "orthopedic" matching "rt")
        if (t.length <= 3) {
          const words = searchTerm.split(/\s+/);
          return words.includes(t);
        }
        return searchTerm.includes(t) || t.includes(searchTerm);
      })) {
        matched.add(subRole);
        break;
      }
    }
  }

  return [...matched];
}

/* ------------------------------------------------------------------ */
/* Main query builder                                                   */
/* ------------------------------------------------------------------ */

type Clause = Record<string, unknown>;

export function buildPDLQuery(
  parsed: Record<string, unknown>,
  filters: Record<string, unknown>,
  _sandbox = false,
  strictFilterMode = false
): Record<string, unknown> {
  let wildcardCount = 0;
  const MAX_WILDCARDS = 20;
  function addWildcard(field: string, pattern: string): Clause | null {
    if (wildcardCount >= MAX_WILDCARDS) return null;
    wildcardCount++;
    return { wildcard: { [field]: pattern } };
  }

  const must: Clause[] = [];
  const should: Clause[] = [];
  const mustNot: Clause[] = [];
  const filterClauses: Clause[] = [
    { term: { location_country: "united states" } },
  ];

  // ═══════════════════════════════════════════
  // PERSON NAME
  // FIX: full_name, first_name, last_name are keyword fields — use term, not match_phrase
  // ═══════════════════════════════════════════
  const personNames = (parsed.person_names as string[]) || [];
  if (personNames.length > 0) {
    const nameClauses: Clause[] = [];
    for (const name of personNames) {
      const lower = name.toLowerCase();
      nameClauses.push({ term: { full_name: lower } });
      const parts = lower.split(/\s+/);
      if (parts.length >= 2) {
        nameClauses.push({
          bool: {
            must: [
              { term: { first_name: parts[0] } },
              { term: { last_name: parts[parts.length - 1] } },
            ],
          },
        });
      }
    }
    must.push({ bool: { should: nameClauses } });
  }

  // ═══════════════════════════════════════════
  // LOCATION (city → metro → state cascade)
  // ═══════════════════════════════════════════
  const l2Location = parsed.location as { state?: string | null; city?: string | null; metro?: string | null } | undefined;
  const legacyLocations = (parsed.locations as { state?: string; city?: string }[]) || [];
  const aiLocations: { state?: string; city?: string }[] = legacyLocations.length > 0
    ? legacyLocations
    : (l2Location && (l2Location.state || l2Location.city))
      ? [{ state: l2Location.state ?? undefined, city: l2Location.city ?? undefined }]
      : [];

  const filterStates = (filters.states as string[]) || [];
  const filterCity = (filters.city as string) || "";
  const geoRadiusMiles = (filters.geo_radius_miles as number) || 10;

  const hasCityFilter = typeof filterCity === "string" && filterCity.trim().length > 0;
  const primaryCities = strictFilterMode
    ? (hasCityFilter ? [filterCity.toLowerCase()] : [])
    : (hasCityFilter ? [filterCity.toLowerCase()] : aiLocations.filter(l => l.city).map(l => (l.city as string).toLowerCase()));

  const expandedCities: string[] = [...primaryCities];
  if (geoRadiusMiles > 0) {
    for (const city of primaryCities) {
      expandedCities.push(...getNearbyCities(city, geoRadiusMiles));
    }
  }
  const uniqueCities = [...new Set(expandedCities)];

  const hasStateFilter = Array.isArray(filterStates) && filterStates.length > 0;
  const allStates = strictFilterMode
    ? filterStates
    : (hasStateFilter ? filterStates : aiLocations.filter(l => l.state).map(l => l.state as string));
  const uniqueStates = [...new Set(allStates.map(s => normalizeState(s)))];

  if (uniqueCities.length > 0) {
    const locationClauses: Clause[] = [];
    for (const city of uniqueCities) {
      locationClauses.push({ term: { location_locality: city } });
      const metroNames = CITY_TO_METRO[city];
      if (metroNames) {
        for (const metro of metroNames) locationClauses.push({ term: { location_metro: metro } });
      }
    }
    filterClauses.push({ bool: { should: locationClauses } });

    const hasRadiusExpansion = uniqueCities.length > primaryCities.length;
    if (uniqueStates.length > 0 && !hasRadiusExpansion) {
      filterClauses.push({ terms: { location_region: uniqueStates } });
    }
  } else if (uniqueStates.length > 0) {
    filterClauses.push({ terms: { location_region: uniqueStates } });
  }

  // ═══════════════════════════════════════════
  // EXPERIENCE RANGE
  // ═══════════════════════════════════════════
  const filterMinExp = Number(filters.min_years_experience ?? 0);
  const minExp = strictFilterMode
    ? (filterMinExp > 0 ? filterMinExp : null)
    : (filterMinExp > 0 ? filterMinExp : ((parsed.min_years_experience as number) ?? null));
  const maxExp = (filters.max_years_experience as number) ?? null;

  if ((minExp !== null && minExp > 0) || (maxExp !== null && maxExp > 0)) {
    const rangeClause: Record<string, number> = {};
    if (minExp !== null && minExp > 0) rangeClause.gte = minExp;
    if (maxExp !== null && maxExp > 0) rangeClause.lte = maxExp;
    filterClauses.push({ range: { inferred_years_experience: rangeClause } });
  }

  // ═══════════════════════════════════════════
  // SENIORITY
  // ═══════════════════════════════════════════
  const seniority = (filters.seniority as string) ?? null;
  if (seniority) {
    filterClauses.push({ term: { job_title_levels: seniority.toLowerCase() } });
  }

  // ═══════════════════════════════════════════
  // COMPANY — three-mode: current, past, any-tenure
  // FIX: Company always goes in must when user specifies one.
  //      Never fall to softShould — if the user said "UC Health"
  //      they want UC Health results, period.
  // FIX: job_company_name and experience.company.name are keyword
  //      fields — use term, not match_phrase.
  // ═══════════════════════════════════════════
  const filterCompaniesArr = (filters.companies as string[]) || [];
  const filterCurrentCompanyStr = (filters.current_company as string) || "";
  const hasFilterCompanies = filterCompaniesArr.length > 0 || filterCurrentCompanyStr.trim().length > 0;

  const rawCompanyList: string[] = filterCompaniesArr.length > 0
    ? filterCompaniesArr
    : filterCurrentCompanyStr
      ? filterCurrentCompanyStr.split(",").map(c => c.trim()).filter(Boolean)
      : [];

  const currentCompanies = strictFilterMode
    ? rawCompanyList.map(normalizeCompany)
    : (hasFilterCompanies
      ? rawCompanyList.map(normalizeCompany)
      : ((parsed.current_companies as string[]) || []).map(normalizeCompany));

  const pastCompanies = ((parsed.past_companies as string[]) || []).map(normalizeCompany);
  const anyCompanies = ((parsed.any_companies as string[]) || []).map(normalizeCompany);

  if (currentCompanies.length > 0) {
    const companyClauses: Clause[] = [];

    // Resolved IDs and names from Company Cleaner (most reliable)
    const resolvedIds = (parsed._resolved_company_ids as string[]) || [];
    const resolvedNames = (parsed._resolved_company_names as string[]) || [];
    const resolvedWebsites = (parsed._resolved_company_websites as string[]) || [];
    const resolvedLinkedinUrls = (parsed._resolved_company_linkedin_urls as string[]) || [];

    for (const id of resolvedIds) {
      companyClauses.push({ term: { job_company_id: id } });
    }
    for (const name of resolvedNames) {
      companyClauses.push({ term: { job_company_name: name } });
    }
    // Additional match surface from Cleaner response
    for (const website of resolvedWebsites) {
      companyClauses.push({ term: { job_company_website: website } });
    }
    for (const linkedinUrl of resolvedLinkedinUrls) {
      companyClauses.push({ term: { job_company_linkedin_url: linkedinUrl } });
    }

    // Also try original + variant names as term matches (keyword field)
    for (const co of currentCompanies) {
      const allVariants = getCompanyVariants(normalizeCompany(co));
      for (const variant of allVariants) {
        companyClauses.push({ term: { job_company_name: variant } });
      }
    }

    // ALWAYS use must — company is a hard requirement when specified
    if (companyClauses.length > 0) {
      must.push({ bool: { should: companyClauses } });
      console.log("Company MUST clause (hard filter):", resolvedIds, resolvedNames, currentCompanies);
    }
  }

  if (pastCompanies.length > 0) {
    const pastClauses: Clause[] = [];
    for (const co of pastCompanies) {
      const variants = getCompanyVariants(co);
      for (const v of variants.slice(0, 5)) {
        // FIX: experience.company.name is keyword — use term
        pastClauses.push({ term: { "experience.company.name": v } });
      }
    }
    must.push({ bool: { should: pastClauses } });
  }

  if (anyCompanies.length > 0) {
    const anyClauses: Clause[] = [];
    for (const co of anyCompanies) {
      const variants = getCompanyVariants(co);
      for (const v of variants.slice(0, 5)) {
        // FIX: both fields are keyword — use term
        anyClauses.push({ term: { job_company_name: v } });
        anyClauses.push({ term: { "experience.company.name": v } });
      }
    }
    should.push({ bool: { should: anyClauses } });
  }

  // ═══════════════════════════════════════════
  // SPECIALTY + KEYWORD SCORING
  // FIX: job_title is keyword — use job_title.text for full-text search
  // ═══════════════════════════════════════════
  const specialties = [
    ...new Set([
      ...(((parsed.specialties as string[]) || (filters.specialties as string[]) || []).map(s => s.toLowerCase())),
      ...((((parsed.specialty ? [parsed.specialty] : []) as string[]) || []).map(s => s.toLowerCase())),
    ]),
  ];
  const requiredKeywords = (parsed.required_keywords as string[]) || (filters.keywords as string[]) || [];
  const allKeywordTerms = [...new Set([...specialties, ...requiredKeywords])];

  if (allKeywordTerms.length > 0) {
    const kwClauses: Clause[] = [];
    for (const kw of allKeywordTerms.slice(0, 15)) {
      // FIX: use .text sub-field for full-text search on keyword field
      kwClauses.push({ match: { "job_title.text": kw } });
      // Also search in summary and headline (actual text fields)
      kwClauses.push({ match: { summary: kw } });
      kwClauses.push({ match: { headline: kw } });
      // skills is keyword — term for exact match
      kwClauses.push({ term: { skills: kw.toLowerCase() } });
    }
    if (kwClauses.length > 0) {
      must.push({ bool: { should: kwClauses } });
    }
  }

  // Specialty employer boost (scoring only, not required)
  const specialtyStr = specialties.length > 0 ? specialties[0] : ((parsed.specialty as string) || null);
  if (specialtyStr && SPECIALTY_EMPLOYERS[specialtyStr]) {
    const empClauses: Clause[] = [];
    for (const emp of SPECIALTY_EMPLOYERS[specialtyStr]) {
      // FIX: job_company_name is keyword — use term with lowercase
      empClauses.push({ term: { job_company_name: emp.toLowerCase() } });
    }
    should.push({ bool: { should: empClauses } });
  }

  // ═══════════════════════════════════════════
  // INDUSTRY FILTER — healthcare focus
  // FIX: Removed title matching from industry clauses.
  //      Role precision is handled by job_title_sub_role below.
  // ═══════════════════════════════════════════
  const industryClauses: Clause[] = [];
  for (const ind of HEALTHCARE_INDUSTRIES) {
    industryClauses.push({ term: { industry: ind } });
    industryClauses.push({ term: { job_company_industry: ind } });
  }

  const mustNotIndustry: Clause[] = [];
  for (const ind of EXCLUDED_INDUSTRIES) {
    mustNotIndustry.push({ term: { industry: ind } });
    mustNotIndustry.push({ term: { job_company_industry: ind } });
  }
  filterClauses.push({ bool: { should: industryClauses, must_not: mustNotIndustry } });

  // ═══════════════════════════════════════════
  // JOB TITLES — scoring boost via must(bool.should)
  // FIX: Use job_title.text for full-text matching
  //      Use experience.title.name.text for past titles
  // ═══════════════════════════════════════════
  const filterJobTitles = (filters.job_titles as string[]) || [];
  const parsedJobTitles = (parsed.job_titles as string[]) || [];
  const titleSynonyms = (parsed.title_synonyms as string[]) || [];
  const rawJobTitles = strictFilterMode
    ? filterJobTitles
    : (filterJobTitles.length > 0
      ? filterJobTitles
      : (parsedJobTitles.length > 0 ? parsedJobTitles : titleSynonyms));
  const jobTitles = [...new Set(rawJobTitles.map(t => t.toLowerCase()))];

  const hasSpecialtyKeywords = allKeywordTerms.length > 0;
  const isSpecialtyOnlyQuery = jobTitles.length === 0 && hasSpecialtyKeywords;
  const expandedTitles = isSpecialtyOnlyQuery ? [] : expandTitleVariants(jobTitles);
  const currentRoleOnly = parsed.current_role_only !== false;

  if (expandedTitles.length > 0) {
    const titleClauses: Clause[] = [];
    for (const t of expandedTitles.slice(0, 20)) {
      const wordCount = t.split(/\s+/).length;
      if (wordCount >= 2) {
        // FIX: use .text sub-field for full-text phrase matching
        titleClauses.push({ match_phrase: { "job_title.text": t } });
        if (!currentRoleOnly) {
          titleClauses.push({ match_phrase: { "experience.title.name.text": t } });
        }
      } else if (t.length >= 4) {
        // Wildcard on keyword field is fine for suffix-only patterns
        const wc = addWildcard("job_title", `${t}*`);
        if (wc) titleClauses.push(wc);
      } else {
        // FIX: use .text sub-field
        titleClauses.push({ match: { "job_title.text": t } });
      }
    }
    if (titleClauses.length > 0) {
      must.push({ bool: { should: titleClauses } });
    }
  }

  // ═══════════════════════════════════════════
  // HEALTHCARE ROLE FILTER — sub_role for precision
  // FIX: Replaces broad job_title_role: "health" + fragile blacklist.
  //      Uses PDL's canonical job_title_sub_role values:
  //      "doctor", "nursing", "dental", "pharmacy", "therapy"
  // ═══════════════════════════════════════════
  if (personNames.length === 0) {
    const targetSubRoles = detectSubRoles(jobTitles, allKeywordTerms);

    if (targetSubRoles.length > 0) {
      // Precise sub_role filter — only returns the role types the user asked for
      filterClauses.push({ terms: { job_title_sub_role: targetSubRoles } });
      console.log("Sub-role filter (precise):", targetSubRoles);
    } else {
      // Generic healthcare search — fall back to role-level filter
      filterClauses.push({ term: { job_title_role: "health" } });
      console.log("Role filter (generic healthcare): job_title_role=health");
    }
  }

  // ═══════════════════════════════════════════
  // ROLE FOCUS FALLBACK — when no titles or specialties specified
  // FIX: Use sub_role terms instead of expensive wildcards
  // ═══════════════════════════════════════════
  if (jobTitles.length === 0 && personNames.length === 0 && !isSpecialtyOnlyQuery) {
    filterClauses.push({
      terms: {
        job_title_sub_role: ["doctor", "nursing", "dental", "pharmacy", "therapy"],
      },
    });
  }

  // ═══════════════════════════════════════════
  // ASSEMBLE FINAL QUERY
  // ═══════════════════════════════════════════
  const query: Clause = {
    bool: {
      filter: filterClauses,
      ...(must.length > 0 ? { must } : {}),
      ...(mustNot.length > 0 ? { must_not: mustNot } : {}),
      ...(should.length > 0 ? { should } : {}),
    },
  };

  console.log("Final query — filter:", filterClauses.length, "| must:", must.length, "| should:", should.length, "| must_not:", mustNot.length, "| wildcards:", wildcardCount);
  return query;
}

/* ------------------------------------------------------------------ */
/* Cascade Step enum + applyStep()                                      */
/* ------------------------------------------------------------------ */

export enum CascadeStep {
  BASE = "base",
  DROP_TITLES = "drop_titles",
  EXPAND_TO_METRO = "expand_to_metro",
  EXPAND_TO_STATE = "expand_to_state",
  DROP_COMPANY = "drop_company",
  DROP_SPECIALTY = "drop_specialty",
  ROLE_ONLY = "role_only",
}

export const CASCADE_ORDER: CascadeStep[] = [
  CascadeStep.BASE,
  CascadeStep.EXPAND_TO_METRO,
  CascadeStep.EXPAND_TO_STATE,
  CascadeStep.DROP_COMPANY,
  CascadeStep.DROP_TITLES,
  CascadeStep.DROP_SPECIALTY,
  CascadeStep.ROLE_ONLY,
];

interface PDLQueryShape {
  filter: Clause[];
  must: Clause[];
  must_not: Clause[];
}

interface ApplyStepPayload {
  location: { state?: string | null; metro?: string | null; city?: string | null; [key: string]: unknown };
}

function isCompanyClause(clause: unknown): boolean {
  if (!clause || typeof clause !== "object") return false;
  const c = clause as Record<string, unknown>;
  if ((c?.term as Record<string, unknown>)?.job_company_name !== undefined) return true;
  if ((c?.term as Record<string, unknown>)?.job_company_id !== undefined) return true;
  if ((c?.term as Record<string, unknown>)?.job_company_website !== undefined) return true;
  if ((c?.term as Record<string, unknown>)?.job_company_linkedin_url !== undefined) return true;
  if ((c?.wildcard as Record<string, unknown>)?.job_company_name !== undefined) return true;
  if ((c?.bool as Record<string, unknown>)?.should) {
    return ((c.bool as Record<string, unknown>).should as unknown[]).some((s) => isCompanyClause(s));
  }
  return false;
}

function termMatches(clause: Clause, field: string): boolean {
  return !!(
    (clause?.term as Record<string, unknown>)?.[field] !== undefined ||
    (clause?.terms as Record<string, unknown>)?.[field] !== undefined
  );
}

export function applyStep(query: PDLQueryShape, payload: ApplyStepPayload, step: CascadeStep): PDLQueryShape {
  switch (step) {
    case CascadeStep.DROP_TITLES:
      return {
        ...query,
        must: query.must.filter(c => isCompanyClause(c)),
        filter: [
          ...query.filter.filter(c =>
            !termMatches(c, "job_title") &&
            !termMatches(c, "job_title_role") &&
            !termMatches(c, "job_title_sub_role")
          ),
          { term: { job_title_role: "health" } },
        ],
      };

    case CascadeStep.EXPAND_TO_METRO: {
      const metro = payload.location.metro;
      if (!metro) return query;
      return {
        ...query,
        filter: query.filter
          .filter(c => !termMatches(c, "location_locality"))
          .concat([{ term: { location_metro: (metro as string).toLowerCase() } }]),
      };
    }

    case CascadeStep.EXPAND_TO_STATE: {
      const state = payload.location.state;
      if (!state) return query;
      return {
        ...query,
        filter: query.filter
          .filter(c => !termMatches(c, "location_locality") && !termMatches(c, "location_metro"))
          .concat([{ term: { location_region: (state as string).toLowerCase() } }]),
      };
    }

    case CascadeStep.DROP_COMPANY:
      return {
        ...query,
        must: query.must.filter(c => !isCompanyClause(c)),
        must_not: query.must_not.filter(c => {
          const term = (c as Record<string, unknown>).term as Record<string, unknown> | undefined;
          return !(term && "job_company_name" in term);
        }),
      };

    case CascadeStep.DROP_SPECIALTY:
      return {
        ...query,
        filter: query.filter.filter(c =>
          !termMatches(c, "industries") && !termMatches(c, "industry") && !termMatches(c, "job_company_name")
        ),
      };

    case CascadeStep.ROLE_ONLY:
      return {
        filter: [{ term: { job_title_role: "health" } }],
        must: [],
        must_not: query.must_not,
      };

    default:
      return query;
  }
}
