/**
 * build-pdl-query.ts — Elasticsearch DSL query builder for clinical healthcare.
 *
 * CRITICAL CHANGE FROM OLD OSLR: SQL → Elasticsearch DSL
 * Uses bool query with filter/must/should/must_not layers.
 *
 * Architecture:
 * - filter = HARD constraints (location, country, industry, experience)
 * - must = required signal groups (person name, current employer)
 * - should = soft scoring boosts (titles, specialty keywords, known employers)
 * - must_not = exclusions (non-healthcare industries, irrelevant roles)
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
} from "./config.ts";

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
  const softShould: Clause[] = [];
  const mustNot: Clause[] = [];
  const filterClauses: Clause[] = [
    { term: { location_country: "united states" } },
  ];

  // ═══════════════════════════════════════════
  // PERSON NAME
  // ═══════════════════════════════════════════
  const personNames = (parsed.person_names as string[]) || [];
  if (personNames.length > 0) {
    const nameClauses: Clause[] = [];
    for (const name of personNames) {
      const lower = name.toLowerCase();
      nameClauses.push({ match_phrase: { full_name: lower } });
      const parts = lower.split(/\s+/);
      if (parts.length >= 2) {
        nameClauses.push({ match_phrase: { first_name: parts[0] } });
        nameClauses.push({ match_phrase: { last_name: parts[parts.length - 1] } });
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
  const uniqueStates = [...new Set(allStates.map(s => s.toLowerCase()))];

  if (uniqueCities.length > 0) {
    const locationClauses: Clause[] = [];
    for (const city of uniqueCities) {
      locationClauses.push({ term: { location_locality: city } });
      const metroNames = CITY_TO_METRO[city];
      if (metroNames) {
        for (const metro of metroNames) locationClauses.push({ term: { location_metro: metro } });
      }
      const wc = addWildcard("location_name", `*${city}*`);
      if (wc) locationClauses.push(wc);
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
    const resolvedIds = (parsed._resolved_company_ids as string[]) || [];
    const resolvedNames = (parsed._resolved_company_names as string[]) || [];
    for (const id of resolvedIds) {
      companyClauses.push({ term: { job_company_id: id } });
    }
    for (const name of resolvedNames) {
      companyClauses.push({ term: { job_company_name: name } });
    }
    for (const co of currentCompanies) {
      const allVariants = getCompanyVariants(normalizeCompany(co));
      for (const variant of allVariants) {
        companyClauses.push({ term: { job_company_name: variant } });
      }
      const lower = normalizeCompany(co);
      const wcCurrent = addWildcard("job_company_name", `*${lower}*`);
      if (wcCurrent) companyClauses.push(wcCurrent);
    }
    if (resolvedIds.length > 0) {
      must.push({ bool: { should: companyClauses } });
      console.log("Company MUST clause (PDL-resolved IDs + names + variants):", resolvedIds, resolvedNames);
    } else {
      softShould.push({ bool: { should: companyClauses, boost: 50 } });
      console.log("Company SOFT clause (no resolved IDs, boost=50):", currentCompanies);
    }
  }

  if (pastCompanies.length > 0) {
    const pastClauses: Clause[] = [];
    for (const co of pastCompanies) {
      const variants = getCompanyVariants(co);
      for (const v of variants.slice(0, 5)) {
        pastClauses.push({ match_phrase: { "experience.company.name": v } });
      }
    }
    must.push({ bool: { should: pastClauses } });
  }

  if (anyCompanies.length > 0) {
    const anyClauses: Clause[] = [];
    for (const co of anyCompanies) {
      const variants = getCompanyVariants(co);
      for (const v of variants.slice(0, 5)) {
        anyClauses.push({ match_phrase: { job_company_name: v } });
        anyClauses.push({ match_phrase: { "experience.company.name": v } });
      }
    }
    should.push({ bool: { should: anyClauses } });
  }

  // ═══════════════════════════════════════════
  // SPECIALTY + KEYWORD SCORING
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
      kwClauses.push({ match: { job_title: kw } });
      const wc = addWildcard("skills", `*${kw}*`);
      if (wc) kwClauses.push(wc);
    }
    should.push({ bool: { should: kwClauses } });
  }

  // Specialty employer boost
  const specialtyStr = specialties.length > 0 ? specialties[0] : ((parsed.specialty as string) || null);
  if (specialtyStr && SPECIALTY_EMPLOYERS[specialtyStr]) {
    const empClauses: Clause[] = [];
    for (const emp of SPECIALTY_EMPLOYERS[specialtyStr]) {
      empClauses.push({ match_phrase: { job_company_name: emp } });
    }
    softShould.push({ bool: { should: empClauses } });
  }

  // ═══════════════════════════════════════════
  // INDUSTRY FILTER — healthcare focus
  // ═══════════════════════════════════════════
  const industryClauses: Clause[] = [];
  for (const ind of HEALTHCARE_INDUSTRIES) {
    industryClauses.push({ term: { industry: ind } });
    industryClauses.push({ term: { job_company_industry: ind } });
  }
  industryClauses.push(
    { match: { job_title: "nurse" } },
    { match: { job_title: "physician" } },
    { match: { job_title: "therapist" } },
    { match: { job_title: "pharmacist" } },
    { match: { job_title: "clinical" } },
    { match: { job_title: "medical" } },
    { match_phrase: { job_title: "healthcare" } },
  );

  const mustNotIndustry: Clause[] = [];
  for (const ind of EXCLUDED_INDUSTRIES) {
    mustNotIndustry.push({ term: { industry: ind } });
    mustNotIndustry.push({ term: { job_company_industry: ind } });
  }
  filterClauses.push({ bool: { should: industryClauses, must_not: mustNotIndustry } });

  // ═══════════════════════════════════════════
  // JOB TITLES — should (scoring boost, not hard filter)
  // ═══════════════════════════════════════════
  const filterJobTitles = (filters.job_titles as string[]) || [];
  const parsedJobTitles = (parsed.job_titles as string[]) || [];
  const titleSynonyms = (parsed.title_synonyms as string[]) || [];
  // Use filter titles first, then parsed job_titles, then fall back to title_synonyms
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

  // Titles that should NOT match via prefix wildcard (e.g. "physician" should not match "physician assistant")
  const EXCLUDED_TITLE_PHRASES = [
    "physician assistant", "physician associate", "pa-c",
    "medical assistant", "certified medical assistant",
    "dental assistant", "pharmacy assistant",
    "certified nursing assistant", "nursing assistant",
    "physician liaison", "physician recruiter", "physician relations",
    "physician advisor", "physician billing", "physician coder",
    "physician scheduler", "physician services", "physician sales",
    "surgical technologist", "certified surgical technologist",
    "surgical technician", "surgical tech",
    "surgical coordinator", "surgical scheduler",
    "surgical neurophysiologist", "neurophysiologist",
    "neuromonitoring technologist", "neuromonitoring tech",
    "doctor of physical therapy", "doctor of chiropractic",
    "medical receptionist", "medical biller", "medical coder",
    "medical secretary", "medical records", "medical transcriptionist",
    "nurse recruiter", "nurse staffing",
  ];
  const searchedTitlesLower = new Set(expandedTitles.map(t => t.toLowerCase()));
  const hasExplicitExcluded = EXCLUDED_TITLE_PHRASES.some(et => searchedTitlesLower.has(et));

  if (expandedTitles.length > 0) {
    const titleClauses: Clause[] = [];
    for (const t of expandedTitles.slice(0, 20)) {
      const wordCount = t.split(/\s+/).length;
      if (wordCount >= 2) {
        titleClauses.push({ match_phrase: { job_title: t } });
        if (!currentRoleOnly) titleClauses.push({ match_phrase: { "experience.title.name": t } });
      } else if (t.length >= 4) {
        const wc = addWildcard("job_title", `${t}*`);
        if (wc) titleClauses.push(wc);
      } else {
        // Short terms like "md", "do" — use exact match, not wildcard
        titleClauses.push({ match: { job_title: t } });
      }
    }
    if (titleClauses.length > 0) {
      should.push({ bool: { should: titleClauses } });
    }
  }

  // ═══════════════════════════════════════════
  // HEALTHCARE ROLE FILTER
  // ═══════════════════════════════════════════
  if (personNames.length === 0) {
    filterClauses.push({ term: { job_title_role: "health" } });
  }

  // Doctor-specific title exclusions
  const doctorTerms = ["physician", "doctor", "md", "surgeon", "attending"];
  const isDoctorSearch = jobTitles.some(t => doctorTerms.some(dt => t.includes(dt)));
  const isExplicitAssistantSearch = jobTitles.some(t =>
    t.includes("assistant") || t.includes("liaison") || t.includes("recruiter") ||
    t.includes("technologist") || t.includes("technician") || t.includes("coordinator") ||
    t.includes("pa-c") || t.includes("physician associate")
  );
  if (isDoctorSearch && !isExplicitAssistantSearch) {
    const nonDoctorExclusions = [
      "physician assistant", "physician associate", "pa-c",
      "medical assistant", "dental assistant", "pharmacy assistant",
      "nursing assistant", "physician liaison", "physician recruiter",
      "surgical technologist", "surgical technician",
      "doctor of physical therapy", "doctor of chiropractic",
    ];
    for (const phrase of nonDoctorExclusions) {
      mustNot.push({ match_phrase: { job_title: phrase } });
    }
    console.log("Doctor-specific exclusions applied:", nonDoctorExclusions.length, "phrases excluded");
  }

  // ROLE FOCUS FALLBACK
  if (jobTitles.length === 0 && personNames.length === 0 && !isSpecialtyOnlyQuery) {
    const roleShouldClauses: Clause[] = [];
    const roleWildcardTerms = [
      "nurse", "physician", "doctor", "surgeon", "therapist", "pharmacist",
      "practitioner", "technician", "hospitalist", "anesthetist",
      "pathologist", "radiologist", "dentist", "hygienist", "paramedic", "midwife",
    ];
    for (const term of roleWildcardTerms) {
      const wc = addWildcard("job_title", `${term}*`);
      if (wc) roleShouldClauses.push(wc);
    }
    if (roleShouldClauses.length > 0) {
      filterClauses.push({ bool: { should: roleShouldClauses } });
    }
  }

  // ═══════════════════════════════════════════
  // ASSEMBLE FINAL QUERY
  // ═══════════════════════════════════════════
  // should = scoring boosts (titles, keywords), must = hard requirements (company)
  const allShould = [...should, ...softShould];

  const query: Clause = {
    bool: {
      filter: filterClauses,
      ...(must.length > 0 ? { must } : {}),
      ...(mustNot.length > 0 ? { must_not: mustNot } : {}),
      ...(allShould.length > 0 ? { should: allShould } : {}),
    },
  };

  console.log("Final query — filter:", filterClauses.length, "| must:", finalMust.length, "| must_not:", mustNot.length, "| wildcards:", wildcardCount);
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
        must: [],
        filter: [
          ...query.filter.filter(c => !termMatches(c, "job_title") && !termMatches(c, "job_title_role")),
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
