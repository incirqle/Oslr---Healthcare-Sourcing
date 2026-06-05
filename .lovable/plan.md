# Company Intel — Audit & Fix Plan (revised)

Confirmed `/job/search` DSL shape. Plan is unchanged otherwise; locking it in here so it's the source of truth for build mode.

## Bugs

1. **Open Positions always empty** — `/job/search` returns HTTP 400 because we send PersonDB DSL (`column`/`type`, `sorts[].column`). v2025-11-01 wants `field`/`op`/`value` for leaves and `field`/`order` for sorts.
2. **Similar Companies show "0 employees" and no logos** — `resolveCompetitorsByDomain` reads `linkedin_headcount` / `linkedin_logo_url` off `/screener/identify`, but `/identify` returns neither. Headcount is always `null` (rendered as "0 employees") and we never have a logo URL to pass.
3. **Leadership shows initials only** — CXO objects from CrustData include `linkedin_url` and sometimes `profile_picture_url`; the modal discards the photo and renders a 2-letter chip.
4. **Modal never receives `crustdata_entity_ids` from search results** — `CompanyIntelCard` passes only `companyName`/`domain`. Every modal open re-runs `/identify`, wasting a credit and risking a different `primary_id` than the search used. `useCompanyEnrichment` and the edge function already accept the IDs; only the prop drilling is missing.
5. **Hiring tab empty-state polish** — when there are no jobs and no department charts, the page renders a half-empty "Open positions" card plus a separate "No hiring data" block.
6. **Blank `/projects/.../search` after closing the modal** (screenshot 3) — likely Radix Dialog leaving `pointer-events: none` on `<body>`. Reproduce in preview; patch if confirmed, otherwise flag as out of scope.

## Fixes

### A. Jobs query DSL — `supabase/functions/company-enrichment/index.ts`
```ts
{
  filters: {
    op: "and",
    conditions: [{ field: "company_id", op: "in", value: ids }]
  },
  sorts: [{ field: "date_added", order: "desc" }],
  limit: 50
}
```
Keep `x-api-version: 2025-11-01`. Log result count.

### B. Competitor enrichment — bulk `/screener/company`
Replace `resolveCompetitorsByDomain` with a single `GET /screener/company?company_id=<id1,id2,...>&fields=company_name,company_website_domain,linkedin_profile_url,linkedin_logo_url,linkedin_headcount` for the (≤6) competitor IDs returned by `/identify`. Add `linkedin_logo_url` to `CompetitorEntry` in `useCompanyEnrichment.ts` and pass it into `<CompanyLogo>` in `CompanyIntelModal`.

### C. Leadership rendering — `CompanyIntelModal.tsx`
- Extend `LeaderEntry` with optional `profile_picture_url`.
- Render `<img>` when present; fall back to initials chip.
- Sort CEO/President/COO first, then alphabetical.
- Don't render the section if list is empty.

### D. Entity-ID plumbing
- Add `crustdataEntityIds?: number[] | null` and `canonicalCompanyName?: string | null` to `CompanyIntelCardProps` and `CompanyIntelModalProps`.
- `CandidateDrawer` and any other caller forwards `candidate._crustdata_entity_ids` and the parsed canonical name.
- `useCompanyEnrichment` already accepts both — no hook change.

### E. Hiring tab empty state
When `jobs.length === 0 && !hasFnTs && !rolesYoy && !rolesSixMo` → single full-width empty card ("No hiring data published for this company"). When jobs are empty but charts exist → drop the "Open positions" section entirely instead of showing an empty stub.

### F. Blank-page check
Reproduce, then patch Radix cleanup if confirmed; otherwise report separately.

## Files
- `supabase/functions/company-enrichment/index.ts` (A, B)
- `src/hooks/useCompanyEnrichment.ts` (B, C — type additions)
- `src/components/CompanyIntelModal.tsx` (B, C, E)
- `src/components/CompanyIntelCard.tsx` (D)
- `src/components/CandidateDrawer.tsx` (D)

Bump cache `schema_version` to `10` (competitor + leadership shape changed) and `DELETE FROM company_enrichment_cache WHERE (data->>'schema_version')::int < 10`.

## Out of scope
Provider swap, new tabs/charts, talent-flow algorithm changes (working: 14 hires / 15 departures for Steadman in logs).
