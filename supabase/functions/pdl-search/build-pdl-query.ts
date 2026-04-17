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
  const geoRadiusExplicit = (filters.geo_radius_miles as number) || 0;

  const hasCityFilter = typeof filterCity === "string" && filterCity.trim().length > 0;
  const primaryCities = strictFilterMode
    ? (hasCityFilter ? [filterCity.toLowerCase()] : [])
    : (hasCityFilter ? [filterCity.toLowerCase()] : aiLocations.filter(l => l.city).map(l => (l.city as string).toLowerCase()));

  // Only auto-expand radius for non-metro small towns.
  // Major metros keep a tight 10mi default; small towns get 15mi (nearby corridor only — no Denver drift).
  const isMajorMetro = (c: string) => ["denver","dallas","houston","austin","los angeles","san francisco","chicago","miami","atlanta","phoenix","seattle","boston","new york","philadelphia","nashville","washington","portland","san diego","tampa","charlotte","raleigh","detroit","minneapolis","salt lake city","baltimore","las vegas","indianapolis","columbus","cleveland","kansas city","richmond","st. louis","milwaukee","memphis","sacramento","louisville","oklahoma city","new orleans","birmingham","tucson","omaha","albuquerque","honolulu","anchorage","orlando","jacksonville","pittsburgh","san antonio","san jose"].includes(c);
  const effectiveRadius = geoRadiusExplicit > 0
    ? geoRadiusExplicit
    : (primaryCities.length > 0 && primaryCities.every(c => !isMajorMetro(c)) ? 15 : 10);

  const expandedCities: string[] = [...primaryCities];
  if (effectiveRadius > 0) {
    for (const city of primaryCities) {
      expandedCities.push(...getNearbyCities(city, effectiveRadius));
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
      // Only inject metro mapping for cities that ARE major metros themselves.
      // Small/resort towns should NOT pull in distant metro results.
      if (isMajorMetro(city)) {
        const metroNames = CITY_TO_METRO[city];
        if (metroNames) {
          for (const metro of metroNames) locationClauses.push({ term: { location_metro: metro } });
        }
      }
    }
    filterClauses.push({ bool: { should: locationClauses } });

    // CRITICAL: Always keep the state constraint when the user asked for a state.
    // Without this, expanded city names like "Avon" or "Eagle" match across the US
    // (Avon, CT; Eagle, ID) instead of staying within Colorado.
    if (uniqueStates.length > 0) {
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
    const resolvedAltNames = (parsed._resolved_company_alt_names as string[]) || [];
    const resolvedAffiliatedIds = (parsed._resolved_company_affiliated_ids as string[]) || [];
    const resolvedWildcards = (parsed._resolved_company_wildcards as string[]) || [];

    // 1. Exact match on Cleaner-resolved company ID
    for (const id of resolvedIds) {
      companyClauses.push({ term: { job_company_id: id } });
    }

    // 2. Exact match on Cleaner-resolved canonical name
    for (const name of resolvedNames) {
      companyClauses.push({ term: { job_company_name: name } });
    }

    // 3. Website and LinkedIn matches from Cleaner
    for (const website of resolvedWebsites) {
      companyClauses.push({ term: { job_company_website: website } });
    }
    for (const linkedinUrl of resolvedLinkedinUrls) {
      companyClauses.push({ term: { job_company_linkedin_url: linkedinUrl } });
    }

    // 4. All alternative names discovered via Enrichment + Autocomplete
    for (const altName of resolvedAltNames.slice(0, 30)) {
      companyClauses.push({ term: { job_company_name: altName } });
    }

    // 5. Affiliated company IDs (from Company Enrichment affiliated_profiles)
    for (const affId of resolvedAffiliatedIds) {
      companyClauses.push({ term: { job_company_id: affId } });
    }

    // 6. Wildcard patterns for root name expansion
    for (const pattern of resolvedWildcards.slice(0, 5)) {
      const wc = addWildcard("job_company_name", pattern);
      if (wc) companyClauses.push(wc);
    }

    // 7. Original + static variant names as fallback
    for (const co of currentCompanies) {
      const allVariants = getCompanyVariants(normalizeCompany(co));
      for (const variant of allVariants) {
        companyClauses.push({ term: { job_company_name: variant } });
      }
    }

    // Deduplicate clauses by serializing
    const seen = new Set<string>();
    const dedupedClauses: Clause[] = [];
    for (const clause of companyClauses) {
      const key = JSON.stringify(clause);
      if (!seen.has(key)) {
        seen.add(key);
        dedupedClauses.push(clause);
      }
    }

    // ALWAYS use must — company is a hard requirement when specified
    if (dedupedClauses.length > 0) {
      must.push({ bool: { should: dedupedClauses } });
      console.log(`Company MUST clause (hard filter): ${dedupedClauses.length} clauses (IDs: ${resolvedIds}, names: ${resolvedNames}, altNames: ${resolvedAltNames.length}, wildcards: ${resolvedWildcards})`);
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
  // FIX (April 2026 v2): If the job-title signals already encode the specialty
  // (e.g. "orthopedic surgeon", "orthopaedic surgeon", "orthopedist"), we do
  // NOT add a second hard keyword must-clause. That double-gate was causing
  // under-retrieval — a real local orthopedist whose PDL record didn't repeat
  // the word "orthopedic" in title/summary/headline/skills was being filtered
  // out even though their title clearly matched.
  //
  // Rule: specialty + role-intent stays HARD. Specialty alone (when titles
  // already cover it) becomes a SOFT scoring boost via `should`.
  // ═══════════════════════════════════════════
  const specialties = [
    ...new Set([
      ...(((parsed.specialties as string[]) || (filters.specialties as string[]) || []).map(s => s.toLowerCase())),
      ...((((parsed.specialty ? [parsed.specialty] : []) as string[]) || []).map(s => s.toLowerCase())),
    ]),
  ];
  const requiredKeywords = (parsed.required_keywords as string[]) || (filters.keywords as string[]) || [];
  const allKeywordTerms = [...new Set([...specialties, ...requiredKeywords])];

  // Detect whether the title set already encodes the specialty.
  // E.g. ["orthopedic surgeon"] for specialty "orthopedic" → titles satisfy specialty.
  const lowerTitlePool = [
    ...((parsed.job_titles as string[]) || []),
    ...((parsed.title_synonyms as string[]) || []),
    ...((filters.job_titles as string[]) || []),
  ].map(t => String(t).toLowerCase());

  const specialtyAlreadyInTitles = specialties.length > 0 && specialties.every(sp => {
    const root = sp.replace(/(s|ic|ics|y)$/i, ""); // ortho, cardio, neuro, etc.
    return lowerTitlePool.some(t => t.includes(sp) || (root.length >= 4 && t.includes(root)));
  });

  if (allKeywordTerms.length > 0) {
    const kwClauses: Clause[] = [];
    for (const kw of allKeywordTerms.slice(0, 15)) {
      kwClauses.push({ match: { "job_title.text": kw } });
      kwClauses.push({ match: { summary: kw } });
      kwClauses.push({ match: { headline: kw } });
      kwClauses.push({ term: { skills: kw.toLowerCase() } });
    }
    if (kwClauses.length > 0) {
      // If titles already encode the specialty, demote keyword cluster to a
      // soft scoring boost. Otherwise keep it as a hard must (existing behavior).
      if (specialtyAlreadyInTitles) {
        should.push({ bool: { should: kwClauses } });
        console.log(`Specialty satisfied by titles (${specialties.join(",")}) — demoted keyword cluster to soft boost.`);
      } else {
        must.push({ bool: { should: kwClauses } });
      }
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
  // ROLE-AWARE PRECISION: detect specific clinician type the user asked for
  // Uses O*NET-SOC 2019 classification for precision filtering.
  // ═══════════════════════════════════════════
  const softShould: Clause[] = [];

  if (personNames.length === 0) {
    const DOCTOR_INTENT     = /\b(doctor|physician|md|surgeon|hospitalist|attending|resident|fellow|dr\.?)\b/i;
    const PA_INTENT         = /\b(physician assistant|pa-?c|pa\b)/i;
    const NP_INTENT         = /\b(nurse practitioner|np\b|aprn|crna)\b/i;
    const RN_INTENT         = /\b(nurse|rn|lpn|lvn|cna)\b/i;
    const THERAPIST_INTENT  = /\b(therapist|pt\b|ot\b|slp|respiratory|physical therapy|occupational therapy)\b/i;
    const PHARMACIST_INTENT = /\bpharmacist\b/i;
    const DENTIST_INTENT    = /\b(dentist|dental hygienist|dds|dmd)\b/i;

    // FIX (April 2026 v2): Detect physician intent from a much wider signal pool.
    // Previously only `jobTitles` was scanned, so when the parser put intent in
    // `title_synonyms` / `required_keywords` / `keywords` / `credentials` (or
    // when titles were dropped during cascade), "doctors in Vail" silently
    // degraded to generic `job_title_role: health` and pulled in audiology
    // doctorates, scribes, etc.
    const intentSignalPool = [
      ...jobTitles,
      ...((parsed.title_synonyms as string[]) || []),
      ...((parsed.required_keywords as string[]) || []),
      ...((parsed.keywords as string[]) || []),
      ...((parsed.credentials as string[]) || []),
      ...specialties,
    ].map(s => String(s).toLowerCase());
    const intentJoined = intentSignalPool.join(" | ");

    const wantsPA         = PA_INTENT.test(intentJoined);
    const wantsNP         = NP_INTENT.test(intentJoined);
    const wantsDoctor     = !wantsPA && DOCTOR_INTENT.test(intentJoined);
    const wantsRN         = !wantsNP && RN_INTENT.test(intentJoined);
    const wantsTherapist  = THERAPIST_INTENT.test(intentJoined);
    const wantsPharmacist = PHARMACIST_INTENT.test(intentJoined);
    const wantsDentist    = DENTIST_INTENT.test(intentJoined);

    const PHYSICIAN_ONET_SPECIFIC = [
      "Anesthesiologists", "Cardiologists", "Dermatologists", "Emergency Medicine Physicians",
      "Family Medicine Physicians", "General Internal Medicine Physicians", "Neurologists",
      "Obstetricians and Gynecologists", "Pathologists", "Pediatricians, General", "Psychiatrists",
      "Radiologists", "Physicians, Pathologists", "Physicians, All Other",
      "Physicians, All Other; and Ophthalmologists, Except Pediatric",
      "Ophthalmologists, Except Pediatric", "Hospitalists", "Sports Medicine Physicians",
      "Ophthalmologists", "Orthopedic Surgeons, Except Pediatric", "Pediatric Surgeons",
      "Surgeons, All Other", "Surgeons",
    ];

    if (wantsDoctor) {
      filterClauses.push({
        bool: {
          should: [
            { terms: { job_onet_specific_occupation: PHYSICIAN_ONET_SPECIFIC } },
            { term:  { job_onet_specific_occupation: "Physicians" } },
            { term:  { job_onet_broad_occupation:   "Physicians" } },
            { term:  { job_onet_broad_occupation:   "Surgeons" } },
            { term:  { job_title_sub_role: "doctor" } },
            { match_phrase: { "job_title.text": "physician" } },
            { match_phrase: { "job_title.text": "surgeon" } },
            { match_phrase: { "job_title.text": "hospitalist" } },
            { match_phrase: { "job_title.text": "cardiologist" } },
            { match_phrase: { "job_title.text": "oncologist" } },
            { match_phrase: { "job_title.text": "pediatrician" } },
            { match_phrase: { "job_title.text": "radiologist" } },
            { match_phrase: { "job_title.text": "anesthesiologist" } },
            { match_phrase: { "job_title.text": "psychiatrist" } },
            { match_phrase: { "job_title.text": "neurologist" } },
            { match_phrase: { "job_title.text": "dermatologist" } },
            { match_phrase: { "job_title.text": "ophthalmologist" } },
            { match_phrase: { "job_title.text": "pathologist" } },
            { wildcard: { job_title: "*, md" } },
            { wildcard: { job_title: "*, md *" } },
            { wildcard: { job_title: "*, do" } },
            { wildcard: { job_title: "*, do *" } },
            { wildcard: { job_title: "dr. *" } },
            { wildcard: { job_title: "dr *" } },
          ],

        },
      });

      // Hard O*NET exclusions
      mustNot.push({ term: { job_onet_broad_occupation:   "Physician Assistants" } });
      mustNot.push({ term: { job_onet_specific_occupation: "Physician Assistants" } });
      mustNot.push({ term: { job_onet_broad_occupation:   "Registered Nurses" } });
      mustNot.push({ term: { job_onet_specific_occupation: "Registered Nurses" } });
      mustNot.push({ term: { job_onet_specific_occupation: "Nurse Practitioners" } });
      mustNot.push({ term: { job_onet_specific_occupation: "Nurse Anesthetists" } });
      mustNot.push({ term: { job_onet_specific_occupation: "Nurse Midwives" } });

      // Title-phrase exclusions for records missing O*NET
      const nonDoctorTitleExclusions = [
        "physician assistant", "physician's assistant", "physicians assistant",
        "nurse practitioner", "registered nurse",
        "licensed practical nurse", "licensed vocational nurse",
        "certified nursing assistant", "medical assistant", "medical scribe",
        "physical therapist", "occupational therapist", "respiratory therapist",
        "speech therapist", "pharmacy technician",
        "radiologic technologist", "surgical technologist",
        "phlebotomist", "patient care technician", "patient care assistant",
        "nursing assistant", "health aide", "medical aide",
        "dental hygienist", "dental assistant",
      ];
      for (const exclusion of nonDoctorTitleExclusions) {
        mustNot.push({ match_phrase: { "job_title.text": exclusion } });
      }
      console.log("DOCTOR intent: O*NET physician filter + hard exclusion of PAs/RNs/NPs/techs/aides");

      softShould.push({ term: { job_title_sub_role:        { value: "doctor",     boost: 10.0 } } });
      softShould.push({ term: { job_onet_broad_occupation: { value: "Physicians", boost: 8.0  } } });
      softShould.push({ term: { job_onet_broad_occupation: { value: "Surgeons",   boost: 8.0  } } });
    } else if (wantsPA) {
      filterClauses.push({
        bool: {
          should: [
            { term: { job_onet_broad_occupation:   "Physician Assistants" } },
            { term: { job_onet_specific_occupation: "Physician Assistants" } },
            { match_phrase: { "job_title.text": "physician assistant" } },
            { wildcard: { job_title: "*, pa-c*" } },
            { wildcard: { job_title: "*, pa-c" } },
          ],

        },
      });
      console.log("PA intent: O*NET physician-assistant filter");
    } else if (wantsNP) {
      filterClauses.push({
        bool: {
          should: [
            { term: { job_onet_specific_occupation: "Nurse Practitioners" } },
            { term: { job_onet_specific_occupation: "Nurse Anesthetists"  } },
            { term: { job_onet_specific_occupation: "Nurse Midwives"      } },
            { match_phrase: { "job_title.text": "nurse practitioner" } },
            { match_phrase: { "job_title.text": "crna" } },
            { match_phrase: { "job_title.text": "aprn" } },
          ],

        },
      });
      mustNot.push({ term: { job_onet_broad_occupation: "Physician Assistants" } });
      mustNot.push({ term: { job_onet_broad_occupation: "Physicians" } });
      console.log("NP intent: O*NET nurse-practitioner filter + exclude MD/PA");
    } else if (wantsRN) {
      filterClauses.push({
        bool: {
          should: [
            { term: { job_onet_specific_occupation: "Registered Nurses" } },
            { term: { job_onet_broad_occupation:   "Registered Nurses" } },
            { term: { job_title_sub_role: "nursing" } },
            { match_phrase: { "job_title.text": "registered nurse" } },
            { match_phrase: { "job_title.text": "nurse" } },
          ],

        },
      });
      mustNot.push({ term: { job_onet_broad_occupation:   "Physician Assistants" } });
      mustNot.push({ term: { job_onet_specific_occupation: "Nurse Practitioners" } });
      mustNot.push({ term: { job_onet_broad_occupation:   "Physicians" } });
      console.log("RN intent: O*NET RN filter + exclude NP/PA/MD");
    } else if (wantsTherapist) {
      filterClauses.push({
        bool: {
          should: [
            { term: { job_title_sub_role: "therapy" } },
            { match_phrase: { "job_title.text": "therapist" } },
          ],

        },
      });
      console.log("Therapist intent: sub_role + title filter");
    } else if (wantsPharmacist) {
      filterClauses.push({
        bool: {
          should: [
            { term: { job_title_sub_role: "pharmacy" } },
            { match_phrase: { "job_title.text": "pharmacist" } },
          ],

        },
      });
      mustNot.push({ match_phrase: { "job_title.text": "pharmacy technician" } });
      console.log("Pharmacist intent: sub_role filter + exclude pharmacy technicians");
    } else if (wantsDentist) {
      filterClauses.push({
        bool: {
          should: [
            { term: { job_title_sub_role: "dental" } },
            { match_phrase: { "job_title.text": "dentist" } },
            { wildcard: { job_title: "*, dds*" } },
            { wildcard: { job_title: "*, dmd*" } },
          ],

        },
      });
      mustNot.push({ match_phrase: { "job_title.text": "dental assistant" } });
      mustNot.push({ match_phrase: { "job_title.text": "dental hygienist" } });
      console.log("Dentist intent: sub_role filter + exclude dental assistants/hygienists");
    } else {
      // Generic healthcare search — fall back to role-level filter
      filterClauses.push({ term: { job_title_role: "health" } });
      console.log("Role filter (generic healthcare): job_title_role=health");
    }
  }

  // ═══════════════════════════════════════════
  // ASSEMBLE FINAL QUERY
  // ═══════════════════════════════════════════
  const query: Clause = {
    bool: {
      filter: filterClauses,
      ...(must.length > 0 ? { must } : {}),
      ...(mustNot.length > 0 ? { must_not: mustNot } : {}),
      ...([...should, ...softShould].length > 0 ? { should: [...should, ...softShould] } : {}),
    },
  };

  console.log("Final query — filter:", filterClauses.length, "| must:", must.length, "| should:", should.length + softShould.length, "| must_not:", mustNot.length, "| wildcards:", wildcardCount);
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

/** Check if a filter clause is a location clause (locality, metro, region, or nested bool containing them) */
function isLocationClause(clause: Clause): boolean {
  if (termMatches(clause, "location_locality")) return true;
  if (termMatches(clause, "location_metro")) return true;
  if (termMatches(clause, "location_region")) return true;
  const boolShould = (clause?.bool as Record<string, unknown>)?.should;
  if (Array.isArray(boolShould)) {
    return boolShould.some((s: unknown) => {
      const sc = s as Clause;
      return termMatches(sc, "location_locality") || termMatches(sc, "location_metro") || termMatches(sc, "location_region");
    });
  }
  return false;
}

/** Check if a filter clause is an O*NET or sub_role based role-intent filter */
function isRoleIntentClause(clause: Clause): boolean {
  // Direct sub_role / O*NET term filters
  if (termMatches(clause, "job_title_sub_role")) return true;
  if (termMatches(clause, "job_onet_broad_occupation")) return true;
  if (termMatches(clause, "job_onet_specific_occupation")) return true;

  // Bool.should blocks containing O*NET or sub_role terms
  const boolShould = (clause?.bool as Record<string, unknown>)?.should;
  if (Array.isArray(boolShould)) {
    return boolShould.some((s: unknown) => {
      const sc = s as Record<string, unknown>;
      return (
        termMatches(sc, "job_title_sub_role") ||
        termMatches(sc, "job_onet_broad_occupation") ||
        termMatches(sc, "job_onet_specific_occupation") ||
        (sc?.terms as Record<string, unknown>)?.job_onet_specific_occupation !== undefined
      );
    });
  }
  return false;
}

export function applyStep(query: PDLQueryShape, payload: ApplyStepPayload, step: CascadeStep): PDLQueryShape {
  switch (step) {
    case CascadeStep.DROP_TITLES: {
      // Drop title/keyword must clauses but KEEP O*NET/sub_role filter and must_not exclusions
      const hasRoleIntent = query.filter.some(c => isRoleIntentClause(c));
      return {
        ...query,
        must: query.must.filter(c => isCompanyClause(c)),
        filter: [
          // Keep O*NET/role-intent filters, location, industry; drop title-specific filters
          ...query.filter.filter(c =>
            isRoleIntentClause(c) ||
            (!termMatches(c, "job_title") && !termMatches(c, "job_title_role"))
          ),
          ...(hasRoleIntent ? [] : [{ term: { job_title_role: "health" } }]),
        ],
      };
    }

    case CascadeStep.EXPAND_TO_METRO: {
      const metro = payload.location.metro;
      if (!metro) return query;
      const metroLower = (metro as string).toLowerCase();
      // Replace the nested location bool clause (not just flat locality terms)
      return {
        ...query,
        filter: query.filter
          .filter(c => !isLocationClause(c))
          .concat([{ term: { location_metro: `${metroLower}, ${(payload.location.state || "").toLowerCase()}` } }]),
      };
    }

    case CascadeStep.EXPAND_TO_STATE: {
      const state = payload.location.state;
      if (!state) return query;
      return {
        ...query,
        filter: query.filter
          .filter(c => !isLocationClause(c))
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

    case CascadeStep.ROLE_ONLY: {
      // Keep O*NET/sub_role filter if it exists, otherwise fall back to broad role
      const roleFilter = query.filter.find(c => isRoleIntentClause(c));
      return {
        filter: roleFilter ? [roleFilter] : [{ term: { job_title_role: "health" } }],
        must: [],
        must_not: query.must_not,
      };
    }

    default:
      return query;
  }
}
