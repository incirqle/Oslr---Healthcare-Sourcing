## Audit findings

No code was changed.

### 1. Why UCHealth has no logo in Employer Intel
- The Employer Intel card is only receiving `companyName={companyName}`.
- The drawer already computes a better company domain as `topCompanyDomain`, but it is not passed into `CompanyIntelCard`.
- Because no domain is passed, `CompanyIntelCard` guesses a domain from the display name:

```text
"uchealth" -> "uchealth.com"
```

- UCHealth’s real domain is `uchealth.org`, so the Clearbit logo request fails and the component falls back to the initial `U`.
- That is why we keep “running in circles”: we improved the visual card, but the data contract still only sends a company name, not the known/normalized domain.

### 2. Why company intel says nothing found
Recent backend logs show this exact path:

```text
[Company Enrich] Cache miss, calling Crustdata: uchealth
[Company Enrich] Could not identify: uchealth
```

So the lookup is reaching the backend, but Crustdata cannot identify the ambiguous name `uchealth` by name alone. We are not sending a better identifier like `uchealth.org` or a company LinkedIn URL.

### 3. Crustdata connection audit
Crustdata is configured and being reached:

```text
[hybrid] config: enabled=true, has_crustdata_key=true
```

But the PersonDB search path is currently failing because our request payload shape is invalid for Crustdata:

```text
CrustData returned 400: {"filters":["Basic filter must have a 'filter_type' or 'column' field"]}
```

Root cause: our Crustdata query builder creates nested boolean filter groups like:

```text
{ type: "OR", value: [...] }
```

Crustdata is rejecting those because each basic filter/group must use the schema it expects, including a `filter_type` or `column` field. So this is not mainly a missing API key problem; it is a payload/schema bug.

### 4. Cache audit
- `company_enrichment_cache` exists.
- Backend permissions are present.
- It caches successful company enrichment for 7 days.
- There is no UCHealth cache row because Crustdata identification fails before anything can be cached.
- The UI intentionally has no visible cache badge, as requested.

## Proposed implementation plan

### Step 1: Stop guessing logos from company name alone
- Pass the already-derived `topCompanyDomain` from `CandidateDrawer` into `CompanyIntelCard`.
- Add a small healthcare alias resolver so names like `uchealth`, `UC Health`, and `University of Colorado Health` resolve to `uchealth.org`.
- Keep the fallback initial only as a true last resort.

### Step 2: Make Employer Intel lookup use stronger identifiers
- Send `company_name` plus `company_domain` to the `company-enrichment` backend function.
- Prefer domain-based/cache-keyed lookup when available.
- Normalize common employer aliases before calling Crustdata.

### Step 3: Fix Crustdata PersonDB query schema
- Update `build-crustdata-query.ts` so Crustdata filters use the API’s accepted filter shape instead of the current invalid nested `OR` blocks.
- Add explicit logging for the request category and Crustdata response status so future failures don’t collapse into “0 results.”

### Step 4: Improve failure reporting without exposing internals
- If Crustdata returns a 400/401/402/429/500, keep the user-facing UI calm, but log a specific backend reason.
- Avoid showing “No intel found” when the real problem is an integration/query error.

### Step 5: Validate with UCHealth
- Test `company-enrichment` using `UCHealth`, `UC Health`, and `uchealth.org`.
- Confirm the card renders the UCHealth logo.
- Confirm successful enrichment is cached and reused for the next lookup.