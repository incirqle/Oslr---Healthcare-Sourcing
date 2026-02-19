

# Switch PDL Search to Preview API + 15 Results Per Page

## What This Changes

Right now, every search hits the full PDL Person Search API, which consumes enrichment credits per record. The Preview Search API uses the **same endpoint** but with a preview-enabled API key -- it returns real data for key identifying fields (name, title, company, location, LinkedIn URL, industry) and `true/false` for everything else. This lets you dial in searches without burning credits.

Enrichment (getting emails, phones, full experience) will remain available as a separate action for later -- we won't touch it in this change.

## Plan

### 1. Update the edge function (`supabase/functions/pdl-search/index.ts`)

**Change the default page size from 25 to 15:**
- In `search_with_filters` action: change default `size` from `25` to `15`
- In the legacy search fallback: change default `size` from `25` to `15`

**Update `transformSearchResults` to handle Preview API responses:**
- The Preview API returns actual values for: `id`, `full_name`, `sex`, `linkedin_url`, `industry`, `job_title`, `job_title_levels`, `job_company_name`, and company location fields
- All other fields (emails, phones, skills, experience) come back as `true`/`false` booleans instead of actual data
- Update the transform to gracefully handle booleans: if `person.skills` is `true` instead of an array, show an indicator like "Available" rather than crashing; same for emails, phones, experience/tenure
- Add a `preview: true` flag to each candidate object so the frontend knows this is preview data

**Update the AI parser system prompt:**
- Remove remaining sales/spine rep references and focus on clinical roles (doctors, nurses, allied health)

### 2. Update the frontend results display (`src/components/search/SearchResults.tsx`)

**Adjust the `Candidate` interface:**
- Add an optional `preview?: boolean` field
- Add optional `has_email?: boolean`, `has_phone?: boolean`, `has_skills?: boolean` fields to indicate data availability without showing actual values

**Update table columns for preview mode:**
- Skills column: instead of showing actual skill badges, show a green "Available" or red "Unavailable" indicator based on the boolean
- Email under the name: hide email text in preview mode, optionally show a small icon indicating email is available
- Tenure column: show "Available" or a dash based on whether experience data exists

### 3. Update the search page (`src/pages/SearchPage.tsx`)

**Change the requested page size to 15:**
- Update the `handleRunSearch` call from `size: 25` to `size: 15`

### 4. Update the filter review total display

- The `parse_filters` step already fetches a count with `size: 1` -- no change needed there
- The count will still reflect the full matching pool; we just fetch 15 at a time

---

## Technical Details

### Preview API behavior (same endpoint, different response shape)

The Preview Search API uses the same `POST /v5/person/search` endpoint. The difference is determined by the API key permissions. Since the user's current `PDL_API_KEY` may already be preview-enabled (or they may need a separate key), the code will treat any boolean field values as "preview mode" automatically -- making it work regardless of which key type is configured.

### Fields returned with real data in Preview mode
- `id`, `full_name`, `sex`, `linkedin_url`
- `industry`, `job_title`, `job_title_levels`
- `job_company_name`, `job_company_location_*`

### Fields returned as `true`/`false` in Preview mode
- `emails`, `phone_numbers`, `mobile_phone`, `work_email`
- `skills`, `experience`, `education`
- `location_locality`, `location_region` (these may or may not be included -- the transform will check)

### Transform logic change (pseudocode)
```text
if typeof person.skills === 'boolean'
  -> has_skills = person.skills, skills = []
else
  -> has_skills = true, skills = person.skills

if typeof person.work_email === 'boolean'
  -> has_email = person.work_email, email = null
else
  -> extract email as before
```

### File changes summary
| File | Change |
|------|--------|
| `supabase/functions/pdl-search/index.ts` | Default size 25 to 15, update transform for preview booleans, clean up AI prompt |
| `src/components/search/SearchResults.tsx` | Add preview-aware rendering for skills/email/tenure columns |
| `src/pages/SearchPage.tsx` | Change `size: 25` to `size: 15` |

