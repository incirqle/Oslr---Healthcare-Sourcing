
Goal

Ship one surgical “search geography” fix so Vail orthopedic searches stay Vail-first, only widen when truly necessary, and clearly tell the user when widening happened.

What’s happening now

- The problem starts before cascade. The base query is already broad:
  - `build-pdl-query.ts` auto-expands non-metro cities to a 50-mile radius.
  - `config.ts` maps `vail` and nearby towns to `denver, colorado`.
  - The built query therefore contains `location_locality: vail` plus nearby towns plus `location_metro: denver, colorado`, which is why Boulder/Castle Rock/Denver-area profiles show up.
- Cascade is too eager:
  - `index.ts` cascades when `results.length < 3` instead of when the actual match total is under 2.
- Cascade geography replacement is flawed:
  - `applyStep()` adds metro/state filters without properly removing the nested base location bool clause, so widening is not controlled cleanly.
- The UI hides what happened:
  - `SearchPage.tsx` ignores cascade metadata and does not send edited location filters back in the backend’s expected structured shape, so users can’t reliably correct geography.

One-go implementation plan

1. Fix base Vail geography in `build-pdl-query.ts`
- Stop injecting Denver metro for small-town/local-market searches by default.
- Split location behavior into:
  - major metros: city + metro is allowed
  - local towns/resort markets: exact city + immediate nearby towns only
- For Vail, keep the base query local:
  - Vail
  - Avon / Edwards / Eagle / Minturn
  - optional next ring like Frisco / Silverthorne only if radius supports it
- Remove Denver/Boulder/Castle Rock from the default Vail search scope.

2. Tighten the location config in `config.ts`
- Remove or neutralize the current `vail -> denver metro` behavior for the base search path.
- Clean the `NEARBY_CITIES` tiers so Vail’s nearby list reflects real local catchment, not statewide leakage.
- Keep metro mappings only for genuine metro-driven searches, not resort-town defaults.

3. Make cascade truly surgical in `index.ts` + `build-pdl-query.ts`
- Change cascade trigger from “first page returned under 3 rows” to “actual total is under 2”.
- Rework location cascade steps so they replace prior location clauses cleanly.
- Use a gentler order:
  1. exact/local scope
  2. nearby local towns
  3. metro only for real metro markets
  4. state only as last resort
- Keep doctor/specialty intent intact while widening geography.

4. Return honest scope metadata from the edge function
- Add response fields for:
  - requested location
  - effective location scope
  - whether expansion occurred
  - which step triggered it
  - corrected total after expansion
- If cascade wins, return the widened total instead of the original base total so the UI never says “0” while showing people.

5. Surface the behavior in the frontend
- Update `SearchPage.tsx` to store search-scope metadata from the function response.
- Add a visible banner in results, e.g.:
  - “Showing 11 orthopedic surgeons within 25 miles of Vail.”
  - or “No exact Vail matches found; expanded to nearby mountain communities.”
- Wire `FilterEditor` location edits into the backend payload as structured `city` / `states` / optional radius so manual location changes actually affect search.

Files to touch

- `supabase/functions/pdl-search/build-pdl-query.ts`
- `supabase/functions/pdl-search/index.ts`
- `supabase/functions/pdl-search/config.ts`
- `src/pages/SearchPage.tsx`
- likely `src/components/search/SearchResults.tsx` or `FilterReview.tsx` for the scope/expansion banner

Expected result

- “Orthopedic surgeons in Vail, Colorado” stays Vail-first.
- No Denver/Boulder/statewide drift unless the base search truly has 0–1 matches.
- If geography broadens, the UI explains exactly what broadened and why.
- Counts and visible results stay consistent.

Technical details

- Current logs already confirm the root issue: the base query includes `location_metro:"denver, colorado"` and multiple widened localities, so the over-broadness is happening before any meaningful cascade.
- This should be implemented as one cohesive geo-control patch, not separate tweaks, so backend location logic, cascade thresholds, totals, and frontend transparency all land together in one go.
