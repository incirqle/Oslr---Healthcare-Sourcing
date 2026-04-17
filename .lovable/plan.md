
Goal: stop guessing. The right next move is a live PDL diagnostic outside the current app flow to establish the real ceiling for “cardiologist at University of Miami.”

What I found from the code review:
- The current shipped version is `v8-cascade-disabled-2026-04-17`, which keeps:
  - company as a hard `must`
  - specialty as a hard `must`
  - cascade disabled except for near-zero result cases
- That explains why you’re seeing ~25–28 highly precise results.
- There is no stored evidence in the codebase or DB schema that proves 80–150 was correct. That number was an estimate, not something grounded in an actual PDL count.

Right fix:
1. Run a direct PDL diagnostic, not the app search pipeline
   - Query raw PDL counts for:
     - University of Miami only
     - UHealth
     - Miller School of Medicine
     - Sylvester
     - Bascom Palmer
     - Jackson Memorial
   - For each, test:
     - strict cardiology
     - softer cardiology variants
     - no specialty filter
   - Pull person IDs and de-duplicate across entities so we get a real unique-person ceiling.

2. Use that diagnostic to choose the fix, with no more back-and-forth
   - If raw PDL unique cardiologists is only ~25–35:
     - keep the strict version
     - do not chase recall that PDL does not actually have
     - focus only on ranking/labeling
   - If raw PDL unique cardiologists is 60+:
     - retrieval is the problem
     - fix affiliate/entity coverage in `index.ts`
     - adjust specialty gating in `build-pdl-query.ts` without reintroducing the noisy cascade
   - If raw PDL pool is large but page 1 is still noisy:
     - retrieval is acceptable
     - ranking/parsing are the problem
     - fix keyword pollution and scorer penalties

3. If retrieval is the problem, implement the smallest safe retrieval fix
   - Keep company locked as a hard requirement
   - Remove generic noise terms like `physician` from specialty-driven searches
   - Expand only verified UMiami affiliate entities discovered by the diagnostic
   - Do not re-enable the broad cascade fallback

4. If ranking is the problem, implement the smallest safe ranking fix
   - Penalize admin/business titles like director, compensation, relations, strategy, business development
   - Preserve specialty-heavy boosts for actual cardiology signals
   - Keep the strict retrieval that produced the clean 25–28 set

5. Validate against one hard acceptance rule
   - We will report:
     - true raw PDL unique count
     - how many are current strict results
     - how many are app-missed but present in PDL
     - whether the final fix should target retrieval or ranking
   - No more “probably.”

Technical details:
- Files already reviewed:
  - `supabase/functions/pdl-search/index.ts`
  - `supabase/functions/pdl-search/build-pdl-query.ts`
  - `supabase/functions/pdl-search/parse-query.ts`
  - `supabase/functions/pdl-search/format-results.ts`
  - `supabase/functions/pdl-search/cache.ts`
- Likely implementation files after the diagnostic:
  - `index.ts` for affiliate scoping / orchestration
  - `build-pdl-query.ts` for specialty/company behavior
  - `parse-query.ts` if generic keyword expansion is poisoning searches
  - `format-results.ts` if ranking still promotes admin titles

What I will do once approved:
- run the direct PDL diagnostic first
- give you the actual unique count
- then ship only the fix supported by that evidence
