
Goal

Stop guessing. Use what PDL actually supports to fix Vail orthopedics under-retrieval in one pass.

What PDL reference confirms

- Most fields are `keyword` → must use `term`/`terms` with lowercase exact values.
- `experience` is `object`, not `nested` → cross-field matching inside one experience entry is not guaranteed. We cannot safely require "this past job was orthopedic AND in Vail" together.
- Key location fields available on a person record include both **personal location** and **current job/company location**:
  - `location_locality`, `location_region`, `location_metro`, `location_country`
  - `job_company_location_locality`, `job_company_location_region`, `job_company_location_metro`, `job_company_location_country`
- Healthcare precision field: `job_title_class` Major Group 29 = "Healthcare Practitioners and Technical Occupations". This is the right hard gate for "doctor", not free-text title matching.
- Full-text match only works on a small set of fields including `job_title.text`, `summary`, `headline`, `experience.title.name.text`, `experience.summary`. Everywhere else needs `term`/`terms`/`wildcard`/`prefix`.

Why current Vail query returns 1–3

Confirmed from the live edge function logs we just pulled:

- Built query restricts location to **personal** locality only:
  - `location_locality IN [vail, edwards, avon, eagle, minturn]`
  - `location_region = colorado`
- Most Vail-area orthopedists (Steadman, Vail Health, The Steadman Clinic, Vail-Summit Orthopaedics) live in Edwards/Avon/Denver/elsewhere but **work** in Vail. PDL stores that under `job_company_location_*`, which we never query.
- Title gate is also too narrow: we don't include `orthopaedic` spelling variants, subspecialty surgeon titles (sports medicine, spine, foot & ankle, hand, joint replacement), or use `job_title.text` match for free-text title hits.
- `must_not: 32` is huge — aggressive exclusion list is also pruning legitimate orthopedic surgeons whose profiles mention excluded terms incidentally.

The actual fix (one pass)

1. Make local geography match practice OR residence
- Replace the locality bool with:
  - `bool.should`:
    - personal-location bool: `location_region=colorado` AND `location_locality IN [vail corridor]`
    - practice-location bool: `job_company_location_region=colorado` AND `job_company_location_locality IN [vail corridor]`
  - `minimum_should_match: 1`
- Keep `location_country=united states` as a hard filter.
- Apply this state-bounded dual-location pattern to all local clinical searches, not just Vail.

2. Use O*NET as the physician hard gate
- For doctor/surgeon intent, require `job_title_class = "healthcare practitioners and technical occupations"` (O*NET Major Group 29).
- Keep the PA/RN/NP/tech/aide exclusions, but trim the `must_not` list to the ones that actually conflict (drop incidental keyword bans that nuke real surgeons).

3. Broaden orthopedic title matching
- Combine `job_titles` AND `title_synonyms` into one `should` cluster (today we drop synonyms when titles exist).
- Add variants:
  - `orthopedic surgeon`, `orthopaedic surgeon`, `orthopedist`, `orthopaedist`
  - subspecialty surgeons commonly used at Steadman/Vail: `sports medicine surgeon`, `spine surgeon`, `foot and ankle surgeon`, `hand surgeon`, `joint replacement surgeon`, `shoulder surgeon`, `knee surgeon`
- Match using BOTH:
  - `terms` on `job_title` (keyword exact)
  - `match_phrase` on `job_title.text` (full-text — supported per PDL ES mapping)
- Treat orthopedic specialty keyword as a soft `should` boost only when title signals already exist (already done — keep it).

4. Cascade only after local dual-location semantic pass fails
- Order:
  1. local exact (Vail corridor, dual location, full physician + ortho title set)
  2. local semantic (drop ortho specialty keywords, keep physician + Vail corridor dual location)
  3. metro
  4. state
- Trigger remains `total < 2`.

5. Honest metadata + UI
- Keep current `geo_scope` reporting; it's already wired.
- No additional UI changes needed unless the new banner copy needs tweaking.

Files to update

- `supabase/functions/pdl-search/build-pdl-query.ts` — dual-location bool, title+synonym merge, `job_title.text` match, trim `must_not`, O*NET physician gate confirmed.
- `supabase/functions/pdl-search/index.ts` — verify cascade ordering uses new local-dual-location step before metro/state.
- `supabase/functions/pdl-search/format-results.ts` — rank candidates whose `job_company_location_locality` is in the Vail corridor above pure residence matches.

Validation after implementation

- Re-run via the deployed function:
  - `orthopedic surgeons in vail colorado` → expect materially more than 3, all Colorado, dominated by Steadman / Vail Health / Vail-Summit Orthopaedics.
  - `doctors in vail` → physicians only, no audiology/MA/scribe.
  - `cardiologists in telluride colorado` → small market; expect semantic-relax banner before any geo widening.
- Inspect logs to confirm:
  - `job_company_location_*` clauses present
  - `job_title.text` match clause present
  - `must_not` count reduced
  - cascade not triggered when total ≥ 2
