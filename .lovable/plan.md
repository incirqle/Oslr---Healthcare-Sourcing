# Surface dedicated PDL email fields

PDL returns two top-level deliverability-validated fields (`work_email`, `recommended_personal_email`) that we currently ignore in favor of the historical `emails[]` array. This plan threads them through the formatter and shows them, labeled, in the candidate row.

## Scope

- `supabase/functions/pdl-search/format-results.ts` — extend `FormattedCandidate` + `mapPerson()`.
- `src/components/search/SearchResults.tsx` — expose the new fields on the `Candidate` type and render Work / Personal email chips in the row.

Out of scope: `build-pdl-query.ts`, `parse-query.ts`, `index.ts`, the PDL request itself, `required_fields`, the drawer (already reads `enriched.work_email`/`personal_emails`), and `scoreAndRankResults()`.

## Edge function changes (`format-results.ts`)

1. Add to `FormattedCandidate` interface:
   - `work_email: string | null`
   - `personal_email: string | null`

2. In `mapPerson()`, compute:
   ```ts
   const workEmail = typeof p.work_email === "string" ? p.work_email : null;
   const personalEmail = typeof p.recommended_personal_email === "string"
     ? p.recommended_personal_email : null;
   ```

3. Return the two new fields.

4. Update the legacy `email` resolver so `work_email` is preferred, keeping current fallbacks (mobile-as-email, recommended_personal, typed work in array, first array entry). This stays backward-compatible with `scoreAndRankResults()` and any code reading `email`.

5. Update `has_contact_info` to also consider the new fields:
   ```ts
   has_contact_info: !!(workEmail || personalEmail) || emails.length > 0 || phones.length > 0 || typeof p.mobile_phone === "string"
   ```

## UI changes (`SearchResults.tsx`)

1. Extend `Candidate` interface with:
   - `work_email?: string | null`
   - `personal_email?: string | null`

2. Replace the single email icon in `ContactIcons` with up to two labeled `mailto:` chips:
   - If `candidate.work_email` → small chip "Work" linking to `mailto:work_email`.
   - If `candidate.personal_email` → small chip "Personal" linking to `mailto:personal_email`.
   - If neither is set but `candidate.email` exists (legacy fallback) → a single unlabeled mail icon chip linking to `mailto:email` (preserves today's behavior for preview rows where the dedicated fields are absent).
   - Phone icon chip stays unchanged.
   - Use existing semantic tokens (`bg-info/10 text-info`, etc.) — no raw colors.
   - Click handlers must `stopPropagation()` so opening the link doesn't also open the candidate drawer.

3. No other call sites change; `SearchPage` already spreads the formatter output into `Candidate`, so the new fields flow through automatically once both interfaces include them.

## Verification

- Re-deploy `pdl-search` and run a sample search; confirm rows show Work/Personal chips when the underlying PDL record has those fields, and fall back to the legacy mail icon otherwise.
- Confirm the candidate drawer still works (it already reads `enriched.work_email` / `personal_emails`, untouched here).
