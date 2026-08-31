/**
 * Health System Resolver — Bug 2 & Bug 3 fixes
 *
 * Provides local company-name resolution against health-systems.json
 * so known health systems skip PDL Company Search/Enrich/Autocomplete
 * API calls entirely.  Also exports a token-validation function that
 * prevents the wildcard-explosion problem (Bug 3).
 */

// Deno supports JSON imports with assert
import healthSystems from "../../../reference/health-systems.json" assert {
  type: "json",
};

// ── Types ────────────────────────────────────────────────────────────

interface HealthSystem {
  id: string;
  canonical: string;
  display_name: string;
  aliases: string[];
  hq_state: string;
  regions: string[];
  hospitals: number;
  type: string;
  subsidiaries: string[];
}

export interface ReferenceResolvedCompany {
  original: string;
  pdl_name: string;
  pdl_id: null;
  website: null;
  linkedin_url: null;
  alt_names: string[];
  affiliated_ids: string[];
  affiliated_names: string[];
  wildcards: string[];
  source: "reference-file";
}

// ── Build lookup maps once at module load ────────────────────────────

const systems: HealthSystem[] = (healthSystems as any).systems ?? [];

const systemsByCanonical = new Map<string, HealthSystem>();
const aliasMap = new Map<string, HealthSystem>();

for (const sys of systems) {
  // Index by canonical (lowercased)
  systemsByCanonical.set(sys.canonical.toLowerCase(), sys);

  // Index every alias
  for (const alias of sys.aliases) {
    aliasMap.set(alias.toLowerCase(), sys);
  }

  // Index every subsidiary as an alias pointing to the parent
  for (const sub of sys.subsidiaries ?? []) {
    aliasMap.set(sub.toLowerCase(), sys);
  }
}

// ── Exported functions ───────────────────────────────────────────────

/**
 * Bug 2 fix — resolve a company name from the local reference file.
 *
 * Returns a fully-formed resolved company object (matching the shape
 * the rest of index.ts expects) or null if the name is not in the
 * reference data, signalling that the caller should fall through to
 * the existing PDL API resolution pipeline.
 */
export function resolveFromReference(
  companyName: string,
): ReferenceResolvedCompany | null {
  const lower = companyName.toLowerCase().trim();

  // 1. Exact canonical match
  let matched = systemsByCanonical.get(lower) ?? null;

  // 2. Alias / subsidiary match
  if (!matched) {
    matched = aliasMap.get(lower) ?? null;
  }

  // 3. Substring match — input contained in a canonical name or vice-versa
  if (!matched) {
    for (const sys of systems) {
      const canon = sys.canonical.toLowerCase();
      if (canon.includes(lower) || lower.includes(canon)) {
        matched = sys;
        break;
      }
    }
  }

  if (!matched) return null;

  // Build the same shape that resolveCompanyNames() pushes into results[]
  const allNames = [
    matched.canonical.toLowerCase(),
    ...matched.subsidiaries.map((s) => s.toLowerCase()),
  ];

  const wildcards = allNames.map((n) => `*${n}*`);

  return {
    original: companyName,
    pdl_name: matched.canonical.toLowerCase(),
    pdl_id: null,
    website: null,
    linkedin_url: null,
    alt_names: matched.subsidiaries.map((s) => s.toLowerCase()),
    affiliated_ids: [],
    affiliated_names: matched.subsidiaries.map((s) => s.toLowerCase()),
    wildcards,
    source: "reference-file",
  };
}

/**
 * Bug 3 fix — validate that a token extracted by extractRootNames()
 * actually appears somewhere in a known health system's name tree
 * (canonical, alias, or subsidiary).
 *
 * Tokens that fail this check are generic words harvested from PDL
 * alt_names that would produce wildcard queries matching thousands
 * of unrelated companies.
 */
export function isHealthRelevantToken(token: string): boolean {
  const lower = token.toLowerCase().trim();
  if (lower.length < 3) return false;

  for (const sys of systems) {
    if (sys.canonical.toLowerCase().includes(lower)) return true;
    if (sys.aliases.some((a) => a.toLowerCase().includes(lower))) return true;
    if (sys.subsidiaries.some((s) => s.toLowerCase().includes(lower))) {
      return true;
    }
  }
  return false;
}
