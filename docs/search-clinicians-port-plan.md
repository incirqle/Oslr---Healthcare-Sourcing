# search-clinicians port plan — 2026-09-14

Sources read for this plan (research step of the loop):
- `OSLR-SEARCH-ENGINE-BLUEPRINT.md` (uploaded, 2026-09-14) — architecture + adaptation spec
- `incirqle-ai/supabase/functions/search-talent/` @ b947683 — reference engine, all core
  files read in-session: index.ts, search-criteria.ts, build-crustdata-w2-query.ts,
  parse-query.ts, w2-audit.ts, widen-criteria.ts, title-vocabulary.ts,
  specialty-companies.ts, provider-employers.ts, semantic-recall.ts,
  fetch-crustdata-results.ts, w2-credit-budget.ts, lib/crustdata-v2.ts, lib/run-log.ts,
  lib/repgpt-auth.ts, ai-router.ts (remaining support files read at port time)
- `docs/search-clinicians-probe-log.md` — live v2 probes run 2026-09-14
- Oslr repo: pdl-search engine (full read), src/pages/SearchPage.tsx + search components
  (agent-mapped), supabase/migrations (table list), supabase/config.toml
- crustdata-reference skill (v1-era; superseded by the blueprint + reference code where
  they conflict — the reference code is live-verified Sept 2026 on v2)

## What is being produced

A new edge function `supabase/functions/search-clinicians/` — a Crustdata-v2-only
clinical people-search engine ported from search-talent per the fork doctrine
(own copy of every dependency; imports nothing from pdl-search or _shared) — plus its
DB migration, config.toml entry, ported test suites, and a frontend hook + page that
render the criteria contract.

## Decisions (verified against sources)

1. **Fork, not refactor.** New folder beside `pdl-search`; `pdl-search` untouched and
   still serving the existing SearchPage until cutover (blueprint §10).
2. **File map** (reference → port):
   - verbatim-with-rename: `lib/crustdata-v2.ts` (drop `enrichSingleV2` — it lazy-imports
     `facility-crustdata.ts` which is not in the fork set; nothing in the engine calls it),
     `lib/crustdata-rate-limit.ts`, `lib/crustdata-killswitch.ts`, `ai-router.ts`,
     `widen-criteria.ts`, `semantic-recall.ts`, `title-vocabulary.ts`,
     `w2-credit-budget.ts` → `credit-budget.ts` (cache-key prefix `clin:`),
     `w2-errors.ts` → `errors.ts`, `w2-match-scope.ts` → `match-scope.ts`,
     `fetch-crustdata-results.ts` (keep cache helpers + normalizeCrustDataV2Profile;
     drop the legacy searchCrustDataPersonDB wrapper + enrichment-cache path not used
     by the engine), `lib/run-log.ts` → clinician tables.
   - rewritten for healthcare: `search-criteria.ts` → `clinician-criteria.ts`,
     `parse-query.ts` (new parser prompt: three archetypes + tense examples),
     `build-crustdata-w2-query.ts` → `build-clinician-query.ts`,
     `w2-audit.ts` grader prompt, `specialty-companies.ts` (graph targets healthcare
     delivery + education industries, not device manufacturers), `index.ts`.
   - **the great inversion** (blueprint §13): `provider-employers.ts` ports as a
     CLASSIFIER (`employerClass(name): "provider" | "commercial" | "unknown"`), never a
     result filter. The reference's `partitionProviderEmployers` exclusion is NOT called;
     grep-gate in re-verify: no `partitionProviderEmployers` in the new engine.
3. **Criteria kinds.** Keep: location, company, past_company, experience, tenure,
   job_change, education, specialty, title, seniority, unsupported. Add (blueprint §13):
   `role_class` {class} (hard, autocomplete-grounded), `credential` {any_of[]} (hard on
   title/headline/education text; grader verifies), `training_stage`
   {profession, stage, year} (hard; title variants + start_date window),
   `employer_group` {name, company_ids[], domains[], name_variants[]} (hard),
   `care_setting` {setting} (soft first). Drop from the port: `award` (medtech sales
   concept; achievement asks in healthcare parse to unsupported for now), `role_function`
   (Sales & Revenue dept — does not transfer; KNOWN_DEPARTMENTS for clinical roles is
   unprobed, so no department gate ships until probed), `industry` boost list.
4. **Tense is per-criterion** (probe D + blueprint §4): `specialty` value becomes
   `{terms[], tense: "current"|"any"|"past"}` — "background in X" ⇒ "any" (adds past
   surfaces for that criterion only); "formerly/used to work in X" as a ROLE ⇒ a
   `past_role` shaped ask expressed as specialty tense "past" + current-role criteria
   from the rest of the sentence. Company tense ports unchanged. The labelled
   past-winners fallback becomes `fallback: "past_role_holders"` with the same cap 15.
5. **Filter-path catalog guard** (probe D: invalid path = billed 400): the builder
   emits only paths from a frozen `V2_FILTER_PATHS` set copied from the reference `F`
   table + the paths live-verified in the probe log. geo_distance targets
   `basic_profile.location`.
6. **connectorVariants extended**: and/&, plus slash-hyphen-space triplet
   ("med surg" ⇄ "med-surg" ⇄ "med/surg"), plus ae/e ("orthopedic" ⇄ "orthopaedic").
   Applied in specialty/title/role_class emission (probe log lesson 2).
7. **Vocabulary**: `clinical-vocabulary.ts` seeds KEYWORD_EXPANSIONS from the existing
   `pdl-search/config.ts` clinical map (390 entries read in-session) — abbreviations →
   canonical specialty terms only; NEVER title inventions. Stated titles/role classes
   ground through free autocomplete (`title-vocabulary.ts`) with the containment guard
   (PGY-pharmacy trap in probe log). Role-class variant lists (nurse → nurse/RN/
   registered nurse etc.) are match TERMS on real index titles, verified by probes.
8. **Auth**: Oslr frontend calls `supabase.functions.invoke` with the user's JWT.
   `lib/auth.ts` = JWT-only resolveCaller (no profile_id passcode flow — that is a
   RepGPT surface Oslr does not have). `verify_jwt = false` in config.toml like every
   other Oslr function; the function itself enforces auth.
9. **DB**: one migration adds `crustdata_cache`, `clinician_searches`,
   `clinician_search_intelligence` (columns mirror talent_* per lib/run-log.ts
   TalentRunRecord minus console-only fields), service-role RLS like `pdl_cache`.
   No `consume_credits` RPC exists in Oslr → the port drops that call and keeps the
   per-hour rate limit (100/h on `clinician_searches`) + the 6-credit session ceiling.
10. **Out of scope now**: NPI verify layer (dropped per Steven), sandbox/demo
    snapshots (`demo_search_snapshots` — Oslr has no such table), PDL LinkedIn-URL
    lookup (a pasted LinkedIn URL routes to Crustdata `personEnrichV2` instead),
    credit_ledger/billing-config port (Oslr has no credit_ledger tables), retiring
    `pdl-search`, migrating saved-candidate identity off `pdl_id`, agent-runner cleanup.
11. **Frontend (phase 1)**: `src/hooks/useClinicianSearch.ts` +
    `src/pages/ClinicianSearch.tsx` at route `/clinician-search` (sidebar entry marked
    "New engine"), rendering: criteria chips (required/ranked/not filtered per
    enforcement), relaxed[] banner, widen_options buttons (re-send cached_parsed +
    removeIds/cityToState), audit verdict badges + verbatim evidence, fallback banner,
    credits display. Shares only `components/ui/*` primitives per fork doctrine.
    Existing SearchPage/pdl-search untouched.

## Verification of plan vs sources (step 3 of the loop)

- Fork doctrine, tense doctrine, honest zero ladder, credit ceiling, versioned cache
  keys: match blueprint §4, §8, §9, §10 and the reference implementations read.
- Field paths + operators: every emitted path either exists in the reference `F` table
  (live-verified dates in comments) or was probed 2026-09-14 (probe log). `in` on
  location.state remains banned; city uses state= AND (city= OR full_location [.]).
- The reference's `award`/`role_function`/`provider-exclusion` are the three pieces the
  blueprint flags as NOT transferring (§11 "the great inversion", §13) — plan items 3
  and the inversion cover all three. KNOWN_DEPARTMENTS is deliberately empty until a
  clinical department value is live-probed (rule: unverified enum values never gate).
- `enrichSingleV2` drop: confirmed nothing in search-talent imports it
  (grep at port time re-checks in the new folder).
- Oslr DB facts (no crustdata_cache, no consume_credits, oslr uses talent-style logging
  via search_audit_logs for pdl-search) read from supabase/migrations in-session.

## Known gaps carried into the build

- Deno is not installed in this environment; install is attempted at check time.
  If unavailable, ported test suites ship but run in CI/local only — named in the
  final report if so.
- `training_stage` date-window filtering on `experience.employment_details.current.start_date`
  is builder-supported per the reference field notes (start_date accepts range ops per
  the v2 catalog); the probe validated reading start_date, not yet filtering on it. The
  builder emits the window ONLY as a soft layer (deterministic rank + grader carry the
  year), never a hard gate, until a live probe confirms range filters on that path.
- Clinical `seniority_level` semantics (probe A showed "CXO" on a chief resident's
  hospital entry) — seniority ports but the parser prompt is instructed to use it only
  for explicit leadership asks, never for training stages.
