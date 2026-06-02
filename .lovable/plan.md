# Company Intel Audit — Root Cause & Fix Plan

## What the user sees
Opening any company card (e.g. **UCHealth**) shows "No public intel found for uchealth — We couldn't locate employer data." Even for companies that clearly exist in Crustdata.

## Verified root cause

I called Crustdata `/screener/identify` directly with `{"query_company_name":"uchealth"}` using our `CRUSTDATA_API_KEY` and got a clean match back:

```json
[
  { "company_id": 1304813, "company_name": "UCHealth", "company_website_domain": "uchealth.org", ... },
  { "company_id": 9819138, "company_name": "UCHEALTH ER", ... }
]
```

Crustdata returns an **array** of candidate matches. Our edge function (`supabase/functions/company-enrichment/index.ts`) treats it as a single object:

```ts
// line 103–113 — identifyByName
const d = await cdPost("/screener/identify", payload);
if (!d?.company_id) return null;      // ← d is an array; d.company_id is undefined
return { company_id: d.company_id, ... };
```

Result: **every** identify call returns `null` → handler returns `{ company: null, error: "Company not found" }`. I confirmed this end-to-end against the deployed function with three variants (`uchealth`, `UCHealth + uchealth.org`, `University of Colorado Health`) — all 200 with `"Company not found"`.

The same array-vs-object bug exists in `resolveCompetitors` (line 196): `query_company_id` lookup also returns an array, so the entire competitor section silently produces zero results.

## Secondary issues found while auditing

1. **Domain-only lookup is invalid.** When called with `{ query_company_website_domain: "uchealth.org" }` (no name), Crustdata rejects: `"Either query_company_name, query_company_website, query_company_crunchbase_url, query_company_linkedin_url or query_company_id parameter is required"`. The correct field for domain-only is `query_company_website`. Today this only matters when name is missing, but it's wrong.

2. **No match-ranking logic.** Even after fixing the array bug, picking `result[0]` blindly will sometimes grab "UCHEALTH ER" instead of the main UCHealth entity. We need to prefer: exact name match → `is_full_domain_match: true` → highest `total_rows`/headcount.

3. **Field map for enrichment is stale.** `enrich()` requests `linkedin_industry`, `linkedin_company_description`, `linkedin_logo_url`, `hq_city`, `hq_state` etc., but `/screener/company?fields=…` only returns fields you list. None of `linkedin_industry`, `description`, `hq_city`, `hq_state` are in our `fields=` param, so the UI always renders blanks for industry/description/city/state even when identify works.

4. **Cache poisoning.** When identify fails we don't cache, which is correct — but old `schema_version: 2` cache rows from any prior partial-success run get served for 7 days. We should bump to `schema_version: 3` after the fix so users immediately get fresh data instead of waiting on TTL.

5. **No logging on identify miss.** The function silently returns "Company not found" with zero log lines, which is why this went undetected. We should `console.warn` the company name + raw Crustdata response shape on miss.

## Fix plan

### Phase 1 — unblock all company intel (critical)
- In `identifyByName`:
  - Treat `cdPost` response as `unknown[]`. If empty → return null.
  - Rank candidates: exact case-insensitive name match first, then `is_full_domain_match`, then largest `linkedin_headcount`/`employee_count_range`.
  - Use `query_company_website` (not `query_company_website_domain`) when only a domain is supplied.
  - Log the chosen `company_id` + candidate count.
- In `resolveCompetitors`: same array-unwrap fix; take `result[0]` per id.

### Phase 2 — restore missing intel fields
- Expand `enrich()` `fields=` to include: `linkedin_industry,linkedin_company_description,linkedin_logo_url,hq_city,hq_state,hq_country,year_founded,linkedin_profile_url,company_website_domain,competitor_ids`.
- Verify each rendered field in `CompanyIntelModal.tsx` has a corresponding key in the request.

### Phase 3 — cache + observability
- Bump cached payload `schema_version` from `2` → `3` so the next view auto-refreshes stale rows.
- Add `console.warn("[company-enrichment] no identify match", { name, domain, raw })` on miss.
- Add `console.info("[company-enrichment] identified", { name, chosen_id, candidate_count })` on success.

### Phase 4 — verification
- Re-curl the deployed function for `uchealth`, `cleveland clinic`, `kaiser permanente`, `the johns hopkins university`, and one tiny private practice to confirm both populated and graceful-empty paths.
- Open the candidate drawer in the preview, click the UCHealth chip on Sergiu Botolin, confirm the modal renders headcount chart, jobs, competitors.

## Files to touch
- `supabase/functions/company-enrichment/index.ts` — all logic fixes
- (No frontend changes; the modal already handles the shape correctly once data arrives.)

## Out of scope
- Switching providers (PDL company API, Clearbit) — Crustdata works once we read its response correctly.
- UI redesign of the empty state — fine as-is for genuine misses.
