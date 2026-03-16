// ─── PDL Query Builder ────────────────────────────────────────────────────────

import { US_STATES, METRO_EXPANSIONS, EXCLUDED_TITLE_PATTERNS } from "./config.ts";
import type { ParsedFilters } from "./parse-query.ts";

// Escape single quotes to prevent SQL injection in PDL queries
function esc(val: string): string {
  return val.replace(/'/g, "''");
}

// Build PDL SQL from structured filters with metro expansion and exclusions
export function filtersToSQL(filters: ParsedFilters): string {
  const conditions: string[] = [];

  // Always scope to healthcare roles
  conditions.push("job_title_role='health'");

  // Title + specialty matching with keyword expansion
  const titleTerms = [...filters.job_titles, ...filters.specialties];
  if (titleTerms.length > 0) {
    // Wildcard budget: max 35 wildcards to prevent overly broad queries
    const limitedTerms = titleTerms.slice(0, 35);
    const titleConditions = limitedTerms.map(
      (t) => `job_title LIKE '%${t.toLowerCase()}%'`
    );
    conditions.push(`(${titleConditions.join(" OR ")})`);
  }

  // Location matching with metro area expansion
  if (filters.locations.length > 0) {
    const locConditions = filters.locations.flatMap((l) => {
      const lc = l.toLowerCase().trim();

      // Check if it's a state
      if (US_STATES[lc]) {
        return [`location_region='${lc}'`];
      }

      // Check for "City State" pattern
      for (const state of Object.keys(US_STATES)) {
        if (lc.endsWith(` ${state}`)) {
          const city = lc.slice(0, lc.length - state.length - 1).trim();

          // Check for metro expansion
          const metroKey = city.toLowerCase();
          if (METRO_EXPANSIONS[metroKey]) {
            const metroCities = METRO_EXPANSIONS[metroKey];
            const metroConditions = metroCities.map(
              (mc) => `(location_locality='${mc}' AND location_region='${state}')`
            );
            return metroConditions;
          }

          return [`(location_locality='${city}' AND location_region='${state}')`];
        }
      }

      // Check for metro expansion by city name alone
      if (METRO_EXPANSIONS[lc]) {
        const metroCities = METRO_EXPANSIONS[lc];
        return metroCities.map((mc) => `location_locality='${mc}'`);
      }

      // Fallback: try both region and locality
      return [`(location_region='${lc}' OR location_locality='${lc}')`];
    });

    if (locConditions.length > 0) {
      conditions.push(`(${locConditions.join(" OR ")})`);
    }
  }

  // Company matching
  if (filters.companies.length > 0) {
    const compConditions = filters.companies.map(
      (c) => `job_company_name LIKE '%${c.toLowerCase()}%'`
    );
    conditions.push(`(${compConditions.join(" OR ")})`);
  }

  // Skills/keyword matching
  if (filters.keywords.length > 0) {
    const kwConditions = filters.keywords.map(
      (k) => `skills LIKE '%${k.toLowerCase()}%'`
    );
    conditions.push(`(${kwConditions.join(" OR ")})`);
  }

  // Exclusion patterns — filter out non-clinical roles
  const exclusions = EXCLUDED_TITLE_PATTERNS.map(
    (p) => `job_title NOT LIKE '%${p}%'`
  );
  conditions.push(`(${exclusions.join(" AND ")})`);

  // Safety: must have at least one meaningful filter beyond role + exclusions
  const meaningfulFilters = conditions.length - 2; // minus role and exclusions
  if (meaningfulFilters <= 0) {
    throw new Error(
      "Filters are too broad — at least a job title, location, or company is required to run a search."
    );
  }

  return `SELECT * FROM person WHERE ${conditions.join(" AND ")}`;
}
