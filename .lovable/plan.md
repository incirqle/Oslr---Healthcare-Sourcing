<final-text>What I found

- The current live query for “orthopedic surgeons in Vail Colorado” is already local and state-bounded:
  - localities: `vail`, `edwards`, `avon`, `eagle`, `minturn`
  - state: `colorado`
  - `cascade_used = false`
  - preview/full total is only `1`
- So the active problem is not geography anymore. The geo changes were part of the confusion, but the current bad behavior is now under-retrieval.
- The real failure is in `build-pdl-query.ts`:
  - surgeon/physician intent is one hard requirement
  - orthopedic specialty text is another hard requirement
  - together they over-constrain the search and exclude real local physicians whose records are classified as doctors/surgeons but do not repeat “orthopedic” in the exact searched fields
- There is also a second bug:
  - “doctor/doctors” intent only looks at `parsed.job_titles`
  - when that array is empty, the query falls back to generic `job_title_role = health`
  - that is why broader Vail doctor searches admit false positives like audiology doctorates

Plan

1. Stop changing geography again
- Keep the current Colorado-bounded Vail corridor logic.
- Do not touch `config.ts` unless a later validation proves a locality list is wrong.

2. Rebuild specialty matching in `build-pdl-query.ts`
- Keep physician/surgeon intent as the hard filter.
- Make orthopedic specialty count as satisfied by title/title-synonym matches like:
  - `orthopedic surgeon`
  - `orthopaedic surgeon`
  - `orthopedist`
- If those title signals exist, do not also force a separate orthopedic keyword must-clause.
- Use specialty text as a strong boost/fallback signal instead of a second independent hard gate.

3. Fix doctor intent detection in `build-pdl-query.ts`
- Detect physician intent from:
  - `job_titles`
  - `title_synonyms`
  - `required_keywords`
  - `keywords`
  - credentials
- This prevents “doctors in Vail” from degrading to generic healthcare.

4. Change fallback order in `index.ts`
- If local Vail results are under 2:
  - first relax semantics inside the same local Colorado corridor
  - only after that consider metro/state widening
- So the order becomes: local exact -> local semantic fallback -> geo expansion.

5. Keep metadata honest
- Return whether the winning fallback was:
  - still local
  - semantic only
  - actual geo expansion
- Update the UI only if needed so it does not imply geography changed when it did not.

Files to update

- `supabase/functions/pdl-search/build-pdl-query.ts`
- `supabase/functions/pdl-search/index.ts`
- optionally `src/components/search/SearchResults.tsx` for clearer fallback messaging

Expected outcome

- “Orthopedic surgeons in Vail, Colorado” stays local.
- The query stops filtering out likely orthopedists just because their profile lacks exact orthopedic keyword text.
- “Doctors in Vail” becomes physician-only instead of generic healthcare.
- Geography only widens after the local semantic pass still produces under 2 results.</final-text>