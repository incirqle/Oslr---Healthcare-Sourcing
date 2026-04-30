
## What the logs actually show

I pulled the `pdl_cache` rows for the most recent Panorama Orthopedics search (the realtime edge function logs are no longer in the buffer, but the cache table is the canonical record of what PDL returned).

Two cache rows for that run:

```
created_at              total   profiles_returned
2026-04-30 19:40:50Z    12      0     ← preview (size=1, count only)
2026-04-30 19:40:59Z    12      12    ← profile fetch
```

Key facts:
- **PDL itself returned `total: 12`** for the assembled query. This is not a post-processing trim. The ceiling is being set inside the Elasticsearch DSL we send PDL.
- All 12 records did come back populated (first record verified: John Froelich MD, hand surgeon @ panorama orthopedics, ai_score 95).
- No cascade fired. Cascade only triggers when `total < 2` (`index.ts:1094`). 12 is above the trigger.
- The `~29` ceiling was an estimate written into the code comment at `build-pdl-query.ts:387`; it was never grounded in a verified PDL count.

## Why we're getting 12, not 29 — line by line

The query for "orthopedic doctors at Panorama Orthopedics in Colorado" assembles these clauses:

| Layer | Clause | Effect |
|---|---|---|
| filter | `location_country = us` | fine |
| filter | location: CO state AND (Golden/Denver locality, personal OR practice) | fine |
| filter | industry IN healthcare set | fine |
| filter (NEW, the tightener) | role gate: `sub_role:doctor OR ONET Physicians/Surgeons OR PHYSICIAN_ONET_SPECIFIC` (`build-pdl-query.ts:900-909`) | **this is the one cutting recall** |
| must | company: panorama variants + `experience.company.*` (small-practice anchor active) | correct |
| must_not | PA / RN / NP / nurse-anesthetist / nurse-midwife O*NET + 18 title exclusions + 6 role exclusions (`:923-974`) | correct in spirit, see issue 2 |
| should / softShould | specialty + title boosts (soft, ranking only) | fine |

There are two real recall losses, both inside the **company-anchored doctor branch**:

### Loss #1 — the inclusive role filter is still not inclusive enough

The filter at line 900 keeps a profile only if:
- `job_title_sub_role = "doctor"`, OR
- `job_onet_broad_occupation IN ["Physicians","Surgeons"]`, OR
- `job_onet_specific_occupation IN PHYSICIAN_ONET_SPECIFIC`

For a small private practice like Panorama, PDL's enrichment is sparse. From the one record we have visibility into, John Froelich's `experience[0].title.sub_role = "doctor"` — but his **current** record may have a different title surface, and PDL only filters on the top-level `job_title_*` fields.

Profiles that lose: any current employee whose `job_title` is something specialty-specific that PDL never tagged (`"Hand Surgeon"`, `"Spine Specialist"`, `"Orthopaedic Traumatologist"`) and where O*NET is null and sub_role isn't "doctor". These people exist at Panorama; they're being silently filtered out.

### Loss #2 — `job_title_role` exclusions over-fire on small practices

Lines 968-973 add hard `must_not` on `job_title_role` ∈ {engineering, information_technology, finance, sales, hr, marketing}. PDL's role tagger is noisy on physician profiles — the same data sparsity that hurts us in Loss #1 also misroutes some MDs into "sales" (because they sit on advisory boards or have a "consultant" line in their title) or "marketing". On a small practice with ~12-30 total candidates, dropping even 2-3 to a misfired role tag is meaningful.

### What was NOT a problem
- Specialty soften is working (`_is_small_practice = true`).
- Company resolution is working — `panorama orthopedics` resolves cleanly via Step 1b enrich-by-name (`index.ts:447-488`), and the `experience.company.*` boost is firing.
- Industry filter is correct and not the cutter (the company filter is already a tighter constraint).
- Always-on PA/RN exclusions are appropriate.

## The fix — narrowly scoped to small-practice + doctor mode

The general principle: when we have a **resolved small-practice anchor**, the company filter is already extremely tight (~12-50 people total), so we should trust the company filter to do the heavy lifting and let role be a soft preference, not a hard gate. The specialty-aware reranker in `format-results.ts` (Tier 1 ONET +30, Tier 2 title +20) already exists to keep real specialists on page 1.

### Step 1 — Make role inclusive when small-practice + doctor anchor

Inside the `if (hasResolvedCompanyAnchor)` branch at `build-pdl-query.ts:892-914`, add a small-practice escape hatch. When `_is_small_practice` is true AND we already have a company anchor, **drop the hard role filter entirely** and rely on:
- the company `must` (already a tight filter)
- the always-on PA/RN/dental `must_not` exclusions (lines 923-944)
- the specialty-aware reranker for ordering

This keeps health-system queries (UMiami, Cleveland Clinic) on the current strict role filter, where it's needed. Only small-practice + doctor + company-anchored queries get the relaxation.

### Step 2 — Don't apply `job_title_role` exclusions for small-practice anchored searches

Lines 968-973 (the engineering/IT/finance/sales/HR/marketing role exclusions) move inside an `if (!isSmallPractice)` guard, joining the existing `if (!hasResolvedCompanyAnchor)` block at line 980. Same reasoning: when the company filter is doing the work and the pool is ≤50 people, broad role exclusions are higher-risk than the already-on title-level exclusions.

The 18 title-level exclusions (`physician assistant`, `medical scribe`, `phlebotomist`, etc.) stay always-on — those are unambiguous.

### Step 3 — Add a small-practice retrieval floor as a guard

In `index.ts` after the first preview, add:
```
if (_is_small_practice && hasResolvedCompanyAnchor && total < 20) {
  // already running the relaxed query above — log and proceed,
  // do NOT trigger the broad cascade (which can drop the company anchor)
  console.log(`[SMALL_PRACTICE] floor check: ${total} hits — relaxed query already active`);
}
```
This is a no-op safety log to make future under-retrieval debuggable. **No new cascade**. The existing `total < 2` cascade trigger remains untouched.

## Why this won't cascade to other queries

- Health systems (UMiami, Cleveland Clinic, HCA): `_is_health_system = true`, `_is_small_practice = false` → no path change. Strict role filter and `job_title_role` exclusions both still fire.
- Intent-only searches ("orthopedic surgeons in Denver", no company): `hasResolvedCompanyAnchor = false` → enters the `else` branch at line 915-918, no path change.
- Non-doctor intents (NP, RN, PA, dentist, therapist, pharmacist) at small practices: those branches (lines 994+) are not modified.
- The change is gated on three simultaneous conditions: `wantsDoctor && hasResolvedCompanyAnchor && _is_small_practice`. That's exactly the Panorama / OrthoSouth shape.

## What to expect after the fix

For "orthopedic doctors at Panorama Orthopedics in Colorado":
- PDL pull moves from 12 → 25-32 (best estimate; will verify with a fresh preview after deploying).
- Real doctors with sparse PDL enrichment recover.
- Top of page 1 stays clean because the specialty-aware reranker handles ordering.

If the new pull comes back at 25-32, we ship. If it comes back at 50+ with non-doctor pollution showing up on page 1, the reranker is the next thing to tighten, not the retrieval. Either way we'll have evidence — not estimates.

## Files to change

- `supabase/functions/pdl-search/build-pdl-query.ts` (lines 892-974) — small-practice escape hatch + role-exclusion guard
- `supabase/functions/pdl-search/index.ts` (after first preview, ~line 1058) — diagnostic floor log

No schema changes. No new env vars. No new dependencies.
