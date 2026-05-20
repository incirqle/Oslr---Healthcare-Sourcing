# Reference Data Integration Guide

How `pdl-search` edge function consumes `health-systems.json` and `clinical-taxonomy.json` at runtime.

---

## File Locations

```
Oslr/reference/
  health-systems.json    # 133 health systems, aliases, subsidiaries
  clinical-taxonomy.json # 80 specialties, NUCC codes, PDL query mappings
```

Both files are static JSON checked into the repo. They are imported at build time by the Deno edge function â no database or external fetch required.

---

## 1. Health Systems â Company Resolution

### Problem it solves
`resolveCompanyNames()` in `index.ts` currently hits PDL Company Search, Enrich, and Autocomplete APIs to resolve a user-typed company name into PDL-canonical names. This burns API calls and still fails on abbreviations like "Iowa Ortho" â resolves to unrelated companies.

### Integration point: `index.ts` â `resolveCompanyNames()`

Add a **local lookup step before any PDL API call**:

```typescript
import healthSystems from "../../reference/health-systems.json" assert { type: "json" };

// Build lookup maps once at module load
const systemsByCanonical = new Map(healthSystems.systems.map(s => [s.canonical, s]));
const aliasMap = new Map<string, typeof healthSystems.systems[0]>();
for (const sys of healthSystems.systems) {
  for (const alias of sys.aliases) {
    aliasMap.set(alias.toLowerCase(), sys);
  }
  // Also index subsidiaries as aliases pointing to the parent
  for (const sub of (sys.subsidiaries || [])) {
    aliasMap.set(sub.toLowerCase(), sys);
  }
}

function resolveFromReference(companyName: string): string[] | null {
  const lower = companyName.toLowerCase().trim();
  
  // Exact canonical match
  const exact = systemsByCanonical.get(lower);
  if (exact) {
    return [exact.canonical, ...exact.subsidiaries];
  }
  
  // Alias match (includes abbreviations and subsidiaries)
  const aliased = aliasMap.get(lower);
  if (aliased) {
    return [aliased.canonical, ...aliased.subsidiaries];
  }
  
  // Fuzzy: check if input is a substring of any canonical or alias
  for (const sys of healthSystems.systems) {
    if (sys.canonical.includes(lower) || lower.includes(sys.canonical)) {
      return [sys.canonical, ...sys.subsidiaries];
    }
  }
  
  return null; // Fall through to PDL API resolution
}
```

### Where to call it

In `resolveCompanyNames()`, add as the first step:

```typescript
async function resolveCompanyNames(companies: string[]): Promise<ResolvedCompany[]> {
  const results: ResolvedCompany[] = [];
  
  for (const name of companies) {
    // Step 0: Local reference lookup (FREE, instant)
    const refMatch = resolveFromReference(name);
    if (refMatch) {
      results.push({
        original: name,
        resolved: refMatch,
        source: "reference-file",
      });
      continue; // Skip PDL API calls entirely
    }
    
    // Step 1: PDL Company Search (existing logic)
    // ...existing code...
  }
  
  return results;
}
```

### Benefits
- Zero API credits for known health systems
- Fixes the "Iowa Ortho" resolution bug (Bug 2 from code review)
- Subsidiaries are included automatically (searching "HCA" also queries "tristar health", "medical city healthcare", etc.)
- Faster response â no network round-trip for the ~133 most common health system searches

### Wildcard filtering bonus

The `extractRootNames()` function (Bug 3 from code review) generates wildcards from company alt_names that pollute results. Systems in `health-systems.json` can serve as a whitelist â only generate wildcards for tokens that appear in a known health system's name:

```typescript
function isHealthRelevantToken(token: string): boolean {
  const lower = token.toLowerCase();
  for (const sys of healthSystems.systems) {
    if (sys.canonical.includes(lower) || 
        sys.aliases.some(a => a.includes(lower)) ||
        sys.subsidiaries.some(s => s.includes(lower))) {
      return true;
    }
  }
  return false;
}
```

---

## 2. Clinical Taxonomy â Specialty Query Building

### Problem it solves
`build-pdl-query.ts` and `config.ts` use ad-hoc `KEYWORD_EXPANSIONS` and hardcoded title lists to build specialty queries. This is incomplete (missing many specialties), sometimes wrong (`optometry` maps to `ophthalmology` titles â Bug 7), and hard to maintain.

### Integration point: `build-pdl-query.ts` â specialty clause construction

Replace the `KEYWORD_EXPANSIONS` lookup with the taxonomy file:

```typescript
import taxonomy from "../../reference/clinical-taxonomy.json" assert { type: "json" };

// Build specialty lookup once
const specialtyMap = new Map(
  taxonomy.specialties.map(s => [s.id, s])
);
// Also index by search_terms for fuzzy matching from user queries
const searchTermIndex = new Map<string, typeof taxonomy.specialties[0]>();
for (const spec of taxonomy.specialties) {
  for (const term of spec.search_terms) {
    searchTermIndex.set(term.toLowerCase(), spec);
  }
  // Index by display name too
  searchTermIndex.set(spec.display.toLowerCase(), spec);
}

function resolveSpecialty(userTerm: string): SpecialtyEntry | null {
  const lower = userTerm.toLowerCase().trim();
  return searchTermIndex.get(lower) || null;
}
```

### Building the ES query from a resolved specialty

Each specialty entry has a `pdl` object with pre-mapped fields:

```typescript
function buildSpecialtyClause(spec: SpecialtyEntry): object {
  const should: object[] = [];
  
  // job_title.text is a TEXT field â use match_phrase
  for (const title of spec.pdl.job_title_text) {
    should.push({ match_phrase: { "job_title": title } });
  }
  
  // job_title_sub_role is a KEYWORD field â use term
  for (const role of spec.pdl.job_title_sub_role) {
    should.push({ term: { "job_title_sub_role": role } });
  }
  
  // O*NET codes â only if present
  if (spec.pdl.onet_specific?.length) {
    should.push({ terms: { "onet_specific": spec.pdl.onet_specific } });
  }
  
  // Skills â TEXT field â match
  for (const skill of (spec.pdl.skills || [])) {
    should.push({ match: { "skills": skill } });
  }
  
  return {
    bool: {
      should,
      minimum_should_match: 1
    }
  };
}
```

### Where to call it

In `build-pdl-query.ts`, replace the `getSpecialtyTitles()` / `KEYWORD_EXPANSIONS` lookup:

```typescript
// Before (in buildQuery or equivalent):
// const titles = getSpecialtyTitles(intent.specialty);  // ad-hoc lookup

// After:
const spec = resolveSpecialty(intent.specialty);
if (spec) {
  const specialtyClause = buildSpecialtyClause(spec);
  must.push(specialtyClause);
} else {
  // Fallback: treat as raw title text search (for specialties not yet in taxonomy)
  must.push({ match_phrase: { "job_title": intent.specialty } });
}
```

### L2 parser integration

`parse-query.ts` can also use the taxonomy for better intent extraction. When the Claude/Gemini parser extracts a specialty from the user's natural language query, validate it against the taxonomy:

```typescript
// In parse-query.ts, after L2 returns parsed intent:
const resolvedSpec = resolveSpecialty(parsedIntent.specialty);
if (resolvedSpec) {
  parsedIntent.specialty = resolvedSpec.id;           // Normalize to canonical ID
  parsedIntent.specialtyDisplay = resolvedSpec.display; // For UI
  parsedIntent.category = resolvedSpec.category;        // Useful for cascade logic
}
```

### Category-aware cascade

The `category` field enables smarter cascade behavior. For example, if a `surgical` specialty search fails at the first cascade step, the cascade could try broadening to the `parent_specialty` before dropping the specialty entirely:

```typescript
function getParentExpansion(specId: string): string[] | null {
  const spec = specialtyMap.get(specId);
  if (spec?.parent_specialty) {
    const parent = specialtyMap.get(spec.parent_specialty);
    if (parent) {
      return parent.pdl.job_title_text;
    }
  }
  return null;
}
```

---

## 3. Config.ts Cleanup

Once both reference files are integrated, the following can be removed from `config.ts`:

| Section | Lines (approx) | Replaced by |
|---------|----------------|-------------|
| `KEYWORD_EXPANSIONS` | ~200 lines | `clinical-taxonomy.json` |
| `COMPANY_ALIASES` | ~50 lines | `health-systems.json` |
| `ONET_CODES` (if present) | ~30 lines | `clinical-taxonomy.json` pdl.onet_specific |
| Ad-hoc title lists | scattered | `clinical-taxonomy.json` pdl.job_title_text |

The `config.ts` file shrinks significantly and the remaining config is truly config (timeouts, thresholds, API keys) rather than domain data.

---

## 4. Deno Import Notes

Supabase Edge Functions run Deno. JSON imports use:

```typescript
// Deno supports JSON imports with assert
import healthSystems from "./reference/health-systems.json" assert { type: "json" };

// Or dynamic import if preferred
const healthSystems = JSON.parse(await Deno.readTextFile(
  new URL("./reference/health-systems.json", import.meta.url)
));
```

The `reference/` directory should be at the same level as `supabase/functions/pdl-search/` or the import path adjusted accordingly. Since these are deployed with the function bundle, there's no runtime file I/O concern.

Recommended file placement options:
1. **Co-located**: `supabase/functions/pdl-search/reference/` (simplest import path)
2. **Shared**: `supabase/functions/_shared/reference/` (if other functions need it)
3. **Repo root**: `reference/` (current location â import with relative path `../../../reference/`)

---

## 5. Maintenance

Both files are designed for easy expansion:

**Adding a health system**: Add an entry to `systems` array, increment `total_systems` in `_meta`. Required: `id`, `canonical`, `display_name`, `aliases`, `hq_state`, `type`.

**Adding a specialty**: Copy an existing entry, change the `id`, `display`, `nucc` code, and `pdl` field mappings. The `_meta.expansion_guide` field has step-by-step instructions. Increment `total_specialties`.

**Versioning**: Bump `_meta.version` on any change. The `generated` date tracks when the file was last rebuilt.
