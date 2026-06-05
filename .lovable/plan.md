# Fix CrustData PersonDB Query Builder + Unified Company Resolution

## Problem

`build-crustdata-query.ts` is sending Realtime Person Search field names (`experience.employment_details.current.title`, `basic_profile.headline`, `professional_network.location.raw`) to the PersonDB Search endpoint, which expects entirely different field names (`current_employers.title`, `headline`, `region`). Fields silently don't match, so results are garbage. Live testing shows UCHealth orthopedic search returns ~29 instead of ~129.

Additionally, PDL and CrustData each resolve company entities independently. We need a single resolution step that feeds both.

## Implementation

### 1. New file: `supabase/functions/pdl-search/resolve-company.ts`

Unified health system entity resolver that runs ONCE per search, before both PDL and CrustData query builders.

- `resolveHealthSystem(name, supabase)` returns `{ entity_ids, academic_ids, all_ids, domains, all_names, linkedin_urls }`
- Pre-mapped table for known systems (UCHealth first)
- Cache hit on `company_entity_cache` Supabase table
- Live fallback: calls CrustData `/screener/identify` by name, then by each returned domain to gather ALL entities sharing that domain (free, 0 credits)
- Upserts resolution into cache permanently

### 2. New migration: `company_entity_cache` table

```sql
CREATE TABLE public.company_entity_cache (
  canonical_name TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
GRANT SELECT, INSERT, UPDATE ON public.company_entity_cache TO service_role;
ALTER TABLE public.company_entity_cache ENABLE ROW LEVEL SECURITY;
-- service-role only (edge function), no anon/authenticated policies
```

### 3. Replace `build-crustdata-query.ts` entirely

Implements three-AND PersonDB pattern with correct field names:

- **AND #1 Company**: `current_employers.company_id` (in entity IDs) OR `current_employers.company_website_domain` (=domain) OR `current_employers.name` (fuzzy fallback)
- **AND #2 Specialty**: OR across `current_employers.title`, `headline`, `summary`, `skills`, `education_background.field_of_study` — 24 specialty keyword library (ortho, cardio, neuro, etc.)
- **AND #3 Clinical role**: OR across `current_employers.title`, `headline`, `education_background.degree_name` — 8 role profiles (physician, nurse, resident, fellow, student, PA, therapist, all_clinical)
- Location uses `region`, `location_state`, `location_country`
- Filter syntax uses `column`/`type`/`value` (not `field`/`type`/`value`) and `(.)` partial / `[.]` exact / `=` / `in` types
- Sort by `years_of_experience_raw` desc
- Cascade steps: `expand_geo`, `drop_role`, `drop_specialty`

### 4. Update `fetch-crustdata-results.ts`

- Change endpoint from `/person/search` to `/screener/persondb/search` in both `runCrustDataPreview` and `fetchCrustDataProfiles`
- Drop the `x-api-version: 2025-11-01` header (PersonDB doesn't use it; Bearer auth is already correct)
- Update the request body shape: `dataset: "people"`, `filters`, `limit`, `sorts`, `post_processing` (drop `count`/`preview` fields)
- For preview: send same query with `limit: 1`, read `total_results` from response
- Adjust `normalizeCrustDataResponse` if PersonDB response shape differs from current Realtime shape (verify by inspecting actual response)

### 5. Update `supabase/functions/pdl-search/index.ts`

After `parseQuery()`, before `buildPDLQuery()`:

- Call `resolveHealthSystem(currentCompanies[0], adminClient)` when companies are present
- Attach resolved data to parsed object: `_resolved_company_names`, `_resolved_company_ids`, `_resolved_company_domains`, `_resolved_company_linkedin_urls`
- New CrustData builder reads these via the existing entity map; PDL builder can opt into `_resolved_company_names` for broader matching (verify current behavior — leave PDL untouched if it already works well)

### 6. Update `config.ts`

Append `CRUSTDATA_COMPANY_ALIASES` map for user-input → canonical name (uc health → uchealth, etc.). Do not modify existing exports.

### 7. Verification (after deploy)

Run "orthopedic surgeons at UCHealth in Colorado" and confirm logs show:

- `[RESOLVE] Pre-mapped: "UCHealth" → 11 entities`
- `[CRUSTDATA] Resolved health system → 11 entity IDs + 3 domain fallbacks`
- `[CRUSTDATA] Specialty "orthopedics": ~25 signals`
- `[CRUSTDATA] Role "physician": ~30 signals`
- CrustData returns ≥100 profiles
- Merged total ≥120

Then sanity-check: "orthopedic nurses at UCHealth" (role flips to nurse), "cardiology fellows" (specialty + fellow role).

## Out of scope (do not touch)

- `parse-query.ts`, `build-pdl-query.ts`, `hybrid-orchestrator.ts`, `hybrid-merge.ts`, `ai-rerank.ts`, `format-results.ts`
- Existing `COMPANY_ALIASES` and `HEALTH_SYSTEM_DIVISIONS` in config.ts (only append new alias map)
- Phone enrichment flow

## Files changed

- **new** `supabase/functions/pdl-search/resolve-company.ts`
- **new** migration creating `company_entity_cache`
- **rewrite** `supabase/functions/pdl-search/build-crustdata-query.ts`
- **edit** `supabase/functions/pdl-search/fetch-crustdata-results.ts` (endpoint + body shape)
- **edit** `supabase/functions/pdl-search/index.ts` (insert resolution step)
- **edit** `supabase/functions/pdl-search/config.ts` (append alias map)
