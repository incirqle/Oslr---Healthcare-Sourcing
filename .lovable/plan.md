
Goal

Fix the real geography bug causing Vail searches to return Avon, CT and Eagle, ID, while keeping cascade conservative.

What I found

- The main problem is not the cascade threshold.
- The current base query expands `vail` to nearby locality names (`edwards`, `avon`, `eagle`, `minturn`) but then drops the Colorado state constraint.
- That means PDL is matching any `avon` or `eagle` in the US, which is why you’re seeing Connecticut and Idaho.
- The logs prove it:
  - preview total is 7 on the local query
  - built query contains locality terms only
  - returned results include `Avon, Connecticut` and `Eagle, Idaho`
- So the bug is: nearby-city expansion is being treated as plain city-name matching instead of “these cities in Colorado”.

Why it got worse

- The recent change correctly removed the default Denver metro widening for Vail.
- But the logic in `build-pdl-query.ts` currently skips adding `location_region` whenever nearby-city expansion is active.
- For ambiguous city names, that makes results broader and less accurate than before.

One-go fix

1. Fix the base location query in `build-pdl-query.ts`
- Keep nearby-city expansion for Vail.
- But always keep the state constraint when the user asked for a state.
- Build location logic as:
  - `location_region = colorado`
  - AND `location_locality IN [vail, edwards, avon, eagle, minturn]`
- Do not drop the state filter just because radius/nearby expansion was used.

2. Make locality expansion state-safe
- Apply the same rule to all expanded-city searches, not just Vail.
- If a city is ambiguous and the parser has a state, the query must remain state-bounded.
- Preserve metro-only behavior for true metro searches, but never at the cost of removing the requested state.

3. Tighten cascade behavior in `index.ts`
- Keep the threshold at `total < 2`.
- Only widen after the state-bounded local search fails.
- When widening, expand in this order:
  1. requested city + nearby cities within requested state
  2. metro (only if appropriate)
  3. full state as last resort
- Use the actually applied step, not the planned step list, when reporting scope.

4. Fix misleading scope metadata
- Current `geo_scope.effective_scope` is derived from the whole cascade plan, which can overstate what happened.
- Return metadata based on the step that actually produced the winning results.
- Example:
  - local if the Colorado-bounded Vail corridor succeeded
  - metro only if metro expansion actually ran and won
  - state only if state expansion actually ran and won

5. Clean up the small frontend issues exposed in this flow
- `FilterReview.tsx`: duplicate badge keys for repeated values like `orthopedics`
- `SearchResults.tsx`: ref warning on a function component
- These are not the search bug, but they should be fixed in the same pass so the flow is clean and debug output is trustworthy.

Files to update

- `supabase/functions/pdl-search/build-pdl-query.ts`
- `supabase/functions/pdl-search/index.ts`
- possibly `supabase/functions/pdl-search/config.ts` only if nearby-city tiers need minor cleanup
- `src/components/search/FilterReview.tsx`
- `src/components/search/SearchResults.tsx`

Expected result

- “orthopedic surgeons in Vail, Colorado” stays in Colorado.
- Nearby results can include Edwards/Avon/Eagle/Minturn, but not Avon, CT or Eagle, ID.
- Cascade only happens when the Colorado-local search is truly under 2 results.
- The UI accurately tells you whether the result set is local, metro, or state-expanded.

Technical details

- Root cause is this branch in `build-pdl-query.ts`:
  - state filter is only added when there is no radius expansion
  - for Vail, radius expansion adds nearby cities, so `location_region: colorado` is omitted
- Current logs confirm the failure pattern:
  - parsed location = Vail, Colorado
  - built query = only locality clauses
  - results = out-of-state city-name collisions
- This is a query-construction bug first, a cascade bug second.
