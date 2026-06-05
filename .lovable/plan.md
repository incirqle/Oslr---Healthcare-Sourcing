
## Audit of Company Intel modal

I traced every layer for `University of Colorado Anschutz` (the screenshots), comparing the rendered modal, `CompanyIntelModal.tsx`, `useCompanyEnrichment.ts`, and `supabase/functions/company-enrichment/index.ts` against what CrustData actually returns.

### Bugs found

**1. Modal does not scroll (both screenshots)**
- `src/components/ui/dialog.tsx` line 39: shadcn `DialogContent` is `display: grid` by default.
- `CompanyIntelModal.tsx` line 725: applies `max-h-[92vh]` + `overflow-hidden` but never switches to flex.
- Line 738: the inner `<Tabs className="flex flex-1 flex-col overflow-hidden">` is a grid child, so `flex-1` has no effect. The grid row auto-sizes to the content's intrinsic height, the dialog clips at 92vh, and the `overflow-y-auto` container at line 767 never gets a bounded height → nothing scrolls.

**2. Glassdoor / G2 / web_traffic are always empty**
- `enrich()` (index.ts line 184-211) asks CrustData for `fields=…,glassdoor,g2,web_traffic,funding_and_investment,…`.
- CrustData's `/screener/company` does not return nested objects under those keys. It returns flat columns: `glassdoor_overall_rating`, `glassdoor_review_count`, `glassdoor_ceo_approval`, `glassdoor_business_outlook`, `glassdoor_recommend_to_friend_percent`, `g2_review_count`, `g2_average_rating`, `monthly_visitors`, `monthly_visitors_mom_pct`, plus `funding_and_investment` (which IS nested).
- Result: `enrichment?.glassdoor` is `undefined` for every company — the KPI never renders, same for `g2` and `web_traffic`. The recently-added flat-fallback in the glassdoor mapper still reads `glassdoor_overall_rating` off a nested object that doesn't exist.

**3. Talent flow returns 0 for almost every company — TWO root causes**

   a. **Single company ID instead of the resolved entity set.** Today `useCompanyEnrichment` calls `company-enrichment` with just `{ company_name, company_domain }`, and the function runs `/screener/identify` to pick ONE `company_id`. For a health system like UCHealth that has 11 CrustData entities (UCHealth Broomfield Hospital, UCHealth Memorial, etc.), we then ask CrustData for hires at just one of those — missing 90%+ of true movement. The pdl-search flow already solves this via `resolveHealthSystem()` in `supabase/functions/pdl-search/resolve-company.ts:102`, which returns `all_ids: number[]`, and `pdl-search/index.ts:888-891` already injects `_p._crustdata_entity_ids` into queries. The company-enrichment function never receives this list.

   b. **`recently_changed_jobs` filter is too narrow.** CrustData only flips that flag for ~the last 90 days. Combined with `current_employers.company_id` it becomes "people who started here in the last 90 days AND still work here" — sparse for slow-turnover orgs. Departures should filter on `past_employers.end_date` instead.

   Net effect: the empty state in `TalentFlowTab.tsx` line 80 hits for almost every company even when there are real recent hires.

**4. Cache invalidation is brittle**
- index.ts line 488 reads cache only when `schema_version === 8`. Previously-viewed companies still carry old payloads with empty `glassdoor` / empty `talent_flow`, so any fix will be masked by stale rows until each `cache_key` is re-fetched. There is no admin path to bust a single row.

**5. Small UI/data issues**
- `Loading` skeleton (line 873) renders inside the un-fixed grid → also clips.
- `Empty` state (line 891) hides the tabs entirely even when partial data (jobs, headcount) is available. The user never sees a friendly partial state.
- `taxonomy.linkedin_industries[0]` mapping (line 578-582) assumes a string, but CrustData usually returns `Array<{ industry: string }>` → renders `[object Object]` for some companies. (Anschutz happens to show "Higher Education" via the scalar `linkedin_industry`.)
- Header (line 818): close `X` overlaps long titles because the title column has no right gutter.
- Logo source order in `CompanyLogo` (line 108-116) is `logoUrl → clearbit → favicon`, but `logoUrl` is `linkedin_logo_url` which is good. Clearbit fails on `.edu` and many non-corporate domains. Order is fine; just verify we're actually passing `linkedin_logo_url` from the enrichment payload (we are, but it's also subject to cache miss).
- Hiring tab labeling: the "Hiring by department" sparkline row's numbers (1,865 / 1,780 / 1,642) are absolute headcount snapshots from `linkedin_headcount_by_role_absolute`, not new hires. Calling that section "Hiring by department" is misleading.

---

## Plan

### Fix 1 — Modal scrolling
- `CompanyIntelModal.tsx` line 725: override `DialogContent` to `flex flex-col` (e.g. via `!grid-cols-none !flex flex-col` or wrap the grid default).
- Header gets `shrink-0`; the Tabs wrapper keeps `flex-1 min-h-0 overflow-hidden`; the per-tab pane wrapper at line 767 gets `flex-1 min-h-0 overflow-y-auto`.
- Verify `Loading` and `Empty` are also inside the flex column so they scroll if they exceed 92vh.

### Fix 2 — Glassdoor / G2 / web_traffic
- In `enrich()`, request the flat field names CrustData actually returns:
  - `glassdoor_overall_rating, glassdoor_review_count, glassdoor_ceo_approval, glassdoor_business_outlook, glassdoor_recommend_to_friend_percent`
  - `g2_review_count, g2_average_rating`
  - `monthly_visitors, monthly_visitors_mom_pct, monthly_visitors_search, monthly_visitors_paid_search, monthly_visitors_direct, monthly_visitors_social`
  - Keep `funding_and_investment` (still nested).
- Rewrite the mappers in index.ts (lines 591-601) to read these flat keys directly:
  - `glassdoor` → `{ overall_rating, review_count, ceo_approval, business_outlook, recommend_to_friend }`
  - `web_traffic` → `{ monthly_visitors, growth_mom_percent }`
  - Add a `g2` mapper.

### Fix 3 — Talent flow recall (use ALL entity IDs)

   a. **Pass the resolved entity set into company-enrichment.**
   - `useCompanyEnrichment.ts`: extend the request body with `crustdata_entity_ids?: number[]` and `canonical_company_name?: string`.
   - `CompanyIntelModal` callers (the candidate drawer / wherever the modal is opened): forward `_crustdata_entity_ids` from the existing search result if present.
   - `company-enrichment/index.ts`: accept `crustdata_entity_ids` in the request body. If provided, skip the single-ID `/screener/identify` step and use this array everywhere a `company_id` filter is built. Cache key becomes the sorted-joined ID list (or canonical name) so all entities share one cached payload.
   - If no IDs are provided, fall back to importing `resolveHealthSystem` from `pdl-search/resolve-company.ts` (move it to a shared file if needed) and resolve on the fly using `company_name`. This covers entry points that don't have the IDs handy.

   b. **Fix the date filters.**
   - Hires query: drop `recently_changed_jobs`. Filter on `current_employers.start_date >= now − 12 months` and `current_employers.company_id IN [...all_ids]`.
   - Departures query: filter on `past_employers.company_id IN [...all_ids]` AND `past_employers.end_date >= now − 12 months` (no `recently_changed_jobs`).
   - Fallback widening: if hires + departures < 5 combined, retry with a 24-month window before returning.
   - Log result counts (`[talent-flow hires] n=… entity_ids=…`) per request.

### Fix 4 — Cache busting
- Bump `schema_version` from `8` → `9` in BOTH the read gate (line 488) and the written payload (line 556).
- Change the cache key to include the resolved entity-ID set so a name-only lookup and an IDs-provided lookup converge: `cacheKey = (canonical_name || company_name).toLowerCase() + ":" + sortedIds.join(",")`.
- One-shot SQL migration: `DELETE FROM company_enrichment_cache WHERE COALESCE((data->>'schema_version')::int, 0) < 9;`

### Fix 5 — Misc UI polish
- Header: reserve right padding (`pr-12` on the title column) so the close `X` never collides with the title.
- Industry mapper: if `linkedin_industries[0]` is an object, read `.industry` / `.name`; fall back to `linkedin_industry` scalar.
- Hiring tab: rename "Hiring by department" → "Headcount by department" since the values are snapshots, not hires. Keep the YoY/6mo growth section separate as the real "growth" view.
- Empty state: only render the full `Empty` component when we have literally no data at all. Otherwise render the tabs and let each tab show its own per-section empty messages (e.g. "No Glassdoor data for this company").

### Technical notes
- Files touched:
  - `src/components/CompanyIntelModal.tsx` — scroll, header padding, empty-state logic, hiring labels
  - `src/hooks/useCompanyEnrichment.ts` — accept and forward `crustdata_entity_ids` + `canonical_company_name`
  - Whatever opens the modal in the candidate drawer / hybrid search results — pass `_crustdata_entity_ids` from the search payload through to the modal
  - `supabase/functions/company-enrichment/index.ts` — fields list, mappers, multi-ID talent-flow filters, schema_version bump, cache key
  - Possibly move `resolveHealthSystem` to `supabase/functions/_shared/` so both `pdl-search` and `company-enrichment` can import it
  - One new SQL migration to clear stale cache rows
- No schema changes to `company_enrichment_cache`.
- No frontend type changes — `GlassdoorData` / `WebTrafficData` already match the proposed mapper output.
