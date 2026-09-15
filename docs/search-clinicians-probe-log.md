# search-clinicians probe log — live Crustdata v2, 2026-09-14

Successor to the probe notebook mandated by OSLR-SEARCH-ENGINE-BLUEPRINT.md §14.1.
All calls against api.crustdata.com v2 (x-api-version 2025-11-01). Autocomplete and
identify calls are free; search probes cost 0.03 credits/returned row.

## Autocomplete probes (title vocabulary)

| Probe | Live index titles found | Lesson |
|---|---|---|
| `podiatr` | Podiatry Resident, Podiatric Resident, Podiatric Surgery Resident, Podiatric Surgical Resident, Podiatrist, Podiatric Surgeon, DPM… | 4 distinct resident spellings — OR all of them |
| `pgy` | Top 25 are ALL **pharmacy** residents (PGY1 Pharmacy Resident, PGY-2 Critical Care Pharmacy Resident…) | **"PGY" alone is a pharmacy trap.** Never emit bare PGY as a filter without profession context. Both `PGY1` and `PGY-1` spellings live (hyphen connector-variant confirmed) |
| `cardiovascular nurse` | Cardiovascular Nurse / Practitioner / Consultant / Navigator / Specialist | clean |
| `cath lab` | Cath Lab RN / Technologist / Tech / Nurse / Registered Nurse / Charge Nurse | "cath lab" is a real title token |
| `med surg` + `med-surg` | **Med/Surg RN, Med-Surg RN, Med Surg RN** all exist | THREE connector spellings (slash most common). connectorVariants must cover `/`, `-`, and space |
| `operating room` | Operating Room Nurse / Registered Nurse / RN / Circulator / Charge Nurse (+ Technician/Tech — different license class) | keep, grader distinguishes RN vs tech |
| `perioperative` | Perioperative Nurse / Registered Nurse / RN / Staff Nurse | sibling term for OR |
| `orthopedic` vs `orthopaedic` | Both spellings fully populated (Orthopedic Surgeon vs Orthopaedic Surgeon, residents, fellows) | ae/e = the and/& lesson; emit both |

## Company resolution probe

- `POST /company/identify` "Veterans Health Administration": dozens of fragmented
  entities. Best anchors: **U.S. Department of Veterans Affairs (crustdata_company_id
  1129891, domain va.gov, 10001+)**, plus per-region "X Veterans Health Care System"
  entities (South Texas 6891547, Gulf Coast 7575637, …), several sharing domain va.gov.
  Also noise at same confidence (CVS Health at 0.6, tiny "Veterans Health Care" LLCs).
  → employer_group for VA = id set + domain va.gov + name-contains OR
  ("Veterans Affairs", "Veterans Health Care System", "VA Medical Center").
  NEVER bare `"VA"` substring.

## Archetype search probes

### A. Podiatric residents in Texas
Filter: OR(4 resident title spellings, current, `(.)`) AND `basic_profile.location.state = "Texas"`.
**19 total.** Rows verify the blueprint's staleness doctrine:
- Stale never-ended "Chief Resident" from 2010 whose `is_default:false` and whose
  `is_default:true` role is practice owner → **use `is_default` + start_date in
  match-scope/grader.**
- "Podiatry Resident" at Rush (Chicago) with null start_date, person in Frisco TX
  co-owning a practice → stale; grader rejects on primary-role test.
- Genuine hit: "Resident Physician - Podiatric Medicine & Surgery", start 2023-06 →
  a current resident whose PGY year is computable by date math (PGY-4 territory in
  fall 2026). **Year math works off `start_date`.**

### B. Cardiovascular nurses, 5+ years, US
Filter: OR(title nurse/[.]RN) AND OR(cardio terms over title/headline/skills) AND
`years_of_experience_raw => 5` AND country=United States.
**19,898 total.** First row is a "Healthcare Executive… Nurse Innovator" headline
match → headline recall needs the grader tier, not a hard gate.

### C. (VA orthopedic physicians — resolution probed above; person-side deferred to
engine acceptance battery.)

### D. Former OR nurse → now med-surg, Dallas (tense-mixed)
Filter: OR(past.title operating room/perioperative) AND OR(current.title med surg /
[.]med/surg / [.]med-surg / medical surgical) AND geo.
- `basic_profile.location.city = "Dallas"` → **0 rows** and the API's remarks
  diagnostics named it (77 match without it). City equality is unreliable.
- `basic_profile.location.region` → **400: not a valid v2 path** (and the failed
  request still billed 3 credits — validate paths locally before sending).
- `geo_distance` works on **`basic_profile.location`** (not `.region`):
  `{location:"Dallas, Texas", distance:50, unit:"mi"}` → **3 rows**, two genuinely
  former-OR-now-med-surg in DFW; one CoxHealth (MO) stray and one whose
  `is_default` current role is a marketing job → match-scope demotion + grader.

## Engine-design consequences

1. Title vocabulary comes from autocomplete at parse time (memoized), seeded by the
   Oslr config.ts clinical map; every emitted variant must contain the user's stated
   term (PGY-pharmacy trap).
2. connectorVariants must generate `/`, `-`, and space spellings (med surg), plus
   ae/e (orthopaedic).
3. Location: state via `basic_profile.location.state =`, city via `geo_distance` on
   `basic_profile.location` clipped by state where possible. Never city `=`.
4. Per-criterion tense is expressible: `experience.employment_details.past.*`
   mirrors `current.*` — the "formerly X now Y" query shape works in one tree.
5. Deterministic layer + grader must read `is_default`, `start_date`/`end_date` to
   kill stale never-closed roles and secondary-role matches.
6. Builder validates every field path against a local catalog before sending
   (invalid path = billed error).
7. `remarks[]` zero-diagnostics (condition_eliminates_all + matches_without) are a
   gift: surface them into the widen ladder to pick which criterion to relax first.

## Acceptance probe (post-build, 2026-09-14)

The archetype-1 filter tree emitted by the BUILT engine modules
(validateAIOutput → mapParsedToCriteria → buildClinicianQuery) executed live:
**15 total in Texas**, rows include a genuine 2024-06-start UT Health resident
(stage_fit in_window), a stale 2021 "Chief Resident Physician – PGY3"
(out_of_window → demoted, grader rejects), and the stale Rush "Podiatry
Resident" whose is_default primary is a practice owner (match_scope
secondary). The deterministic layers catch exactly the failure shapes the
probes predicted. Engine test suite: 10/10 passing under Deno.

## Round 2 probes (2026-09-15) — employer resolution, size, ranges

- **University of Miami fanout** (`/company/identify` + person-index employer
  autocomplete): identify returns the two UM entities (6052108, 6510636),
  University of Miami Health System / UHealth (1142323), Miller School of
  Medicine (6061457), UM Hospital (1346670) — AND same-confidence noise (a
  TV station, the law review, Hillel, student clubs). Health-relatedness
  filtering is mandatory. Autocomplete on
  `experience.employment_details.current.name` returns the employer-name
  variants people actually list ("UHealth - University of Miami Health
  System", "UHEALTH UNIVERSITY OF MIAMI", "University of Miami - School of
  Nursing and Health Studies") → employer-resolution.ts pipeline:
  identify → health filter → brand-token autocomplete fanout → cached group.
- **Headcount filter**
  (`experience.employment_details.current.company_headcount_latest =< 50`,
  Georgia family medicine): 188 total, rows show untracked-headcount (0)
  private practices passing the cap — exactly the small-practice population.
  Caveat: a min-floor excludes untracked employers (criterion note says so).
  Employment-entry AND semantics appear element-scoped; the grader
  backstops any cross-entry leak.

## Round 3 probes (2026-09-15) — subspecialty depth + hyper-local geo

- **Where subspecialty lives** (autocomplete): titles carry FELLOWSHIP forms
  ("Arthroplasty Fellow", "Fellowship in Arthroplasty"), education
  field_of_study carries "Adult Reconstruction (Fellowship)", and SKILLS carry
  the full procedure ladder (Total Knee/Hip Arthroplasty, Revision, Hip and
  Knee, Total Joint). Nobody's current title says "joint reconstruction" —
  the subspecialty must be matched on procedure + fellowship + description
  surfaces, never titles alone.
- **The money query, live** (engine-shaped tree): joint reconstruction
  orthopedic surgeons within 15mi of Golden OR Boulder CO → **17–36 total**
  depending on surface set. Real hits (Boulder Bone and Joint president,
  Orthopedic Centers of Colorado Niwot, Swedish Medical Center ortho chief)
  plus the exact demotion cases the layers exist for: a Foot & Ankle
  subspecialty headline (sibling → grader weak), an ortho ONCOLOGIST
  (sibling), an ortho trauma PA (license class → weak/reject). geo_distance
  with a location STRING ("golden, colorado", 15mi) geocodes correctly.
- Engine changes: SUBSPECIALTIES taxonomy (15 families across ortho, cardio,
  neuro, derm, GI, OB); mapper splits subspecialty from parent into AND-ed
  criteria (merged, the parent term would satisfy the OR alone and dilute
  the ask to "any orthopedic surgeon"); builder adds fellowship education
  surfaces per subspecialty; city-level locations gain a 15mi geo circle;
  semantic recall now ALWAYS runs on subspecialty asks; grader gets a
  SUBSPECIALTY context line with the sibling map.
