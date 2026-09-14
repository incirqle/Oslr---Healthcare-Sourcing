# Oslr Search Engine Blueprint
## The complete RepGPT-for-Hiring architecture review, adapted for healthcare sourcing

**Written:** 2026-09-14
**Source system:** `incirqle/incirqle-ai` → `supabase/functions/search-talent/` (the RepGPT
W2 hiring engine), built and live-verified against the Crustdata v2 API 2026-09-09 → 09-11.
**Purpose:** everything we learned building an elite natural-language people-search engine,
organized so the Oslr version can be built from this document without re-fighting a single
battle we already won. Every number in here was measured live, not guessed.

**Target product:** Oslr — RepGPT for healthcare sourcing and recruiting (Juicebox/Apollo
class, hyper-verticalized on healthcare). Canonical query archetypes:

1. *"Find me PGY-3 podiatric residents in the state of Texas."*
2. *"Find me nurses with a cardiovascular background with 5 years of experience."*
3. *"Find all the orthopedic physicians at the VA."*

---

# Part I — The architecture that works

## 1. The pipeline, end to end

One edge function, one natural-language sentence in, one ranked evidence-backed page out:

```
raw query
  → PARSE        one Claude Haiku call → typed payload (validator must pass EVERY field)
  → CRITERIA     typed contract: [{id, kind, label, value, enforcement, source, note}]
                 enforcement ∈ hard (filtered) | soft (ranked) | dropped (surfaced, honest)
  → RESOLVE      company names → exact company_ids via /company/identify (FREE)
                 stated titles → real index titles via /person/search/autocomplete (FREE)
  → BUILD        criteria → one v2 filter tree (AND of leaves/OR-groups)
  → SEARCH       one POST /person/search, limit 50, cached 4h, credit-ceilinged
  → RECALL       three ADDITIVE passes, each deduped into the base set:
                   a. lexical field-widening (built into the tree)
                   b. semantic recall (search:{query,mode:"hybrid"} + mode:"exact")
                   c. entity graph (specialty → companies declaring it → their people)
  → RANK         deterministic, stable: match-scope (primary role first),
                 then evidence-tier (award/credential proof first, trainees last)
  → AUDIT        one Claude pass per profile chunk (25/chunk, chunks in PARALLEL):
                 verdict strong/weak/reject + 0-100 score in the SAME read.
                 rejects removed; sort = verdict tier → score → stable index
  → ZERO-CASE    honest empty state → labelled fallback (capped 15) → auto-widen ladder
  → RESPOND      rows + criteria chips + relaxed[] + widen_options[] + audit summary
                 + engine_version + run intelligence logged to its own tables
```

Latency budget observed: 30–60s for a full cold run; the audit is roughly half.
The audit model is env-switchable (`W2_AUDIT_MODEL`); Opus is the quality default,
Sonnet halves audit time when the deterministic layer is carrying the precision.

## 2. The criteria contract — the single most important pattern

Everything flows through one typed list. Each criterion:

```ts
{ id: "c3",                    // POSITIONAL — widen actions target these ids,
                               // so a widen MUST reuse the cached parse
  kind: "specialty",           // location | award | company | past_company | title |
                               // seniority | min_years_experience | role_function |
                               // specialty | unsupported
  label: "Orthopedic Trauma",  // what the user sees on the chip
  value: [...],                // typed per kind (see §4)
  enforcement: "hard",         // hard → in the filter tree ("required" chip)
                               // soft → ranking only ("ranked" chip)
                               // dropped → honest "not filtered" chip
  source: "user",              // user | inferred — never invent user intent
  note: "..." }                // human explanation shown on hover
```

Why this is the backbone:
- **The UI chips are the contract echoed back.** The user always sees exactly what was
  required, what was ranked, and what the engine could not express. When we could not
  filter "may potentially leave their jobs," the chip said "not filtered" and the concept
  was handed to the AI grader as intent — honest beats fake.
- **Widen actions are criterion transformations**, not new queries: demote hard→soft
  (keeps ranking!), city→state, remove-by-id. Positional ids mean a widen re-sends
  `cached_parsed` so the parse is never re-run and ids stay stable.
- **The cache key is the canonicalized criteria** (kind+enforcement+value only; id and
  label excluded) so two routes to the same resolved search share one cache row.

## 3. Parsing rules that came from blood

- **NEVER invent titles.** The original parser mapped "reps" → a hand-written list of
  titles as hard filters; real sellers are titled "Spine Specialist" / "Clinical
  Consultant", so the invented requirement excluded exactly the people being searched
  for. Rule: expansion only ever happens around a title the USER NAMED, via the
  provider's free autocomplete (§5.2), capped at 8, every variant must contain the
  stated term. For Oslr: "nurses" must not become a guessed title list either —
  it becomes a role-class criterion (see Part III).
- **The validator must carry every parsed field.** `validateAIOutput` silently dropped
  `min_years_experience` and `exclude_current_companies` — "5+ years" and "used to work
  at Arthrex" parsed correctly and vanished before the builder. Both bugs shipped.
  Test the FULL chain per field: prompt → validator → mapper → builder → wire.
- **Company tense is grammar**: "at X" → current employer; "former X" / "used to work
  at X" → past employer AND `exclude_current` (a "formerly at Arthrex" search returned
  a current Arthrex director until exclusion was wired: 7 → 6, live).
- **One model, deterministic fallback.** Haiku parses; a rule-based fallback answers if
  the model call fails. No multi-provider router — it was complexity with no payoff.
- **Multiple CURRENT employers are alternatives (OR).** "at Stryker or Arthrex or
  Conmed" ANDed = guaranteed zero (nobody works three places). Fixed → 694 live.
  Multiple PAST employers stay ANDed on purpose: career chains are conjunctive.

## 4. TENSE IS A REQUIREMENT (the 2026-09-11 lesson — do not rebuild this bug)

The single worst late defect: specialty text was searched across 8 fields INCLUDING past
job titles and past job descriptions. Combined with an award filter that also (correctly)
searches history, both hard filters could be satisfied ENTIRELY from a person's past —
"top reps at orthopedic trauma companies in New York" returned a current AWS account
manager whose old role read "Trauma Sales Rep — President's Club 2018". Measured:
263 rows with past fields in the specialty OR-group, 144 without.

The doctrine, verbatim into Oslr:

- **Present-tense identity criteria (specialty, role, employer) match CURRENT surfaces
  only**: headline, current title, current employer name, current role description,
  About/summary, skills.
- **Historical-evidence criteria (awards; for Oslr: certifications, past training
  programs) keep full history** — a 2019 credential is still a credential.
- **Past surfaces are opt-in** (`pastSpecialty`-style flag), used ONLY by the labelled
  fallback (§8).
- **The grader enforces it too**: "TENSE IS INTENT — unless the query asks for
  former/past people, the current primary occupation must fit the ask; history never
  rescues a current role outside the asked vertical" — with an explicit carve-out
  CONTEXT line when the page is the labelled past-holders fallback.

For Oslr this maps directly: a former cardiac nurse now in pharma sales must NOT match
"nurses with a cardiovascular background" — unless the recruiter asked for career
changers, or lands on the labelled fallback page.

---

# Part II — Every Crustdata call, exactly as used

All calls: `https://api.crustdata.com`, header `x-api-version: 2025-11-01`, token via
`Authorization: Token <CRUSTDATA_API_TOKEN>`. Oslr keeps its OWN copy of the client
(fork doctrine, §10) — file to copy and adapt: `search-talent/lib/crustdata-v2.ts`
(~800 lines: typed `V2Result` union, per-endpoint rate limiting, kill switch,
`insufficientCredits` detection).

## 5.1 `POST /person/search` — the workhorse

```jsonc
{
  "filters": { /* tree, §5.7 */ },
  "limit": 50,                       // billed 0.03 credits PER RETURNED ROW; empty = FREE
  "fields": [ /* projection, §5.8 */ ],
  // semantic mode (recall pass b):
  "search": { "query": "<raw user sentence verbatim>", "mode": "hybrid" },
  "mode": "exact"                    // REQUIRED with search{}: keeps filters HARD.
                                     // Without it the provider treats filters as hints
                                     // and geography silently stops being enforced.
}
```

- Empty probes bill 0 → the auto-widen ladder and fallback probes are free until they
  find someone. This billing property is load-bearing for the whole zero-case design.
- Response: `profiles[]` (nested shape), `total_count`, `next_cursor`.

## 5.2 `GET /person/search/autocomplete` — FREE title vocabulary

`/person/search/autocomplete?field=title&query=trauma sales` → the titles actually in
the index, by frequency. This replaced model-guessed synonyms entirely. Probed live:
"trauma sales" → Trauma Sales Representative / Associate / Consultant / Manager / Rep /
Specialist. Client-side guard: keep only variants containing the stated term (autocomplete
drifts: "sales" → "Sales Engineer"). Memoize per isolate. For Oslr this is the FIRST tool
to reach for on clinical titles — probe "cardiovascular nurse", "cath lab", "PGY", 
"podiatric resident", "hospitalist" before writing any vocabulary by hand.

## 5.3 `POST /company/identify` — FREE name→id resolution

Input `{"query": "<name>", "count": 5}` → candidates with `company_id`, name, domain.
ALWAYS resolve named employers to ids before filtering: bare `"Stryker"` as a name
substring also matches a printing shop and an energy drink; "Smith & Nephew" has 25
same-name entities (canonical: "Smith+Nephew", id 641828). Exact-id leaves also make
cache keys stable. For Oslr §12.3: the VA is the extreme version of this problem.

## 5.4 `POST /company/search` — the entity graph

```jsonc
{ "filters": { "op": "and", "conditions": [
    { "op": "or", "conditions": [
      { "field": "taxonomy.professional_network_specialities", "type": "(.)", "value": "foot & ankle" },
      { "field": "taxonomy.professional_network_specialities", "type": "(.)", "value": "foot and ankle" } ]},
    { "field": "taxonomy.professional_network_industry", "type": "in",
      "value": ["Medical Equipment Manufacturing", "Medical Device"] } ]},
  "limit": 100 }                     // 0.03 credits per returned company
```

This is recall pass (c): "at [specialty] companies" is a statement about the EMPLOYER
that the person rarely repeats. Companies declare it themselves. Live: 130 foot-and-ankle
device companies; following the employment edge (`current.company_id in [ids]`) found
Texas RSMs with zero foot/ankle words anywhere on their profile. **The graph pass is
inherently present-tense** — current employees of matching companies — which is why it
survives the tense doctrine untouched. (Company SEMANTIC search returned
`permission_error` on our account — ask the vendor to enable it; the specialities-text
search above is the working fallback.)

## 5.5 `POST /person/enrich` — deep single-profile pull

2 credits/match. Used ONLY on explicit click ("award proof" panel): structured honors,
full skills, summary. Never called by the search pipeline. 30-day cache.

## 5.6 `POST /company/enrich` — employer intelligence

2 credits/match, six field groups (headcount+growth timeseries, funding, leadership,
job openings, news, description). On-click only, 30-day server cache + session client
cache. Product lesson: we built this onto the candidate card and Steven cut it — **the
expanded card is the PERSON (About, role history with raw descriptions, education,
logos), not the employer.** Keep employer intel as a separate deliberate surface.

## 5.7 Filter-tree semantics — the measured lab notebook

Leaves `{field, type, value}`, branches `{op: "and"|"or", conditions: []}`. Operators
as MEASURED (docs were wrong in places):

| Operator | Documented | **Measured reality** |
|---|---|---|
| `[.]` | "exact substring" | **Case-insensitive WHOLE-WORD / adjacent-phrase match.** `"distribut"` → 0 rows; `"distributor"` → 761. Punctuation is tokenized away but words are not stemmed. |
| `(.)` | scored substring | Same tokenization, contributes to scoring. |
| `(!)` | NOT substring | Works as negation leaf. |
| `=` / `!=` / `in` / `not_in` | equality/sets | `=` fine. **`in` on location state values silently matches NOTHING** — banned; emit an OR of `=` leaves per state (Southeast = OR of 7 `=` leaves, 39 live). |
| `geo_distance` | radius | Works; clip to state to stop bleed (Bay Area = SF 60mi ∧ state=CA, 51 live, all in-region). |
| nested OR-of-AND | undocumented | **Accepted and correct** (measured 1,043 on a per-group-scoped query). Not contractual — confirm with vendor before depending on it. |

**Connector spelling:** `[.]` tokenization means `"and"` ≠ `"&"`. "foot and ankle"
matched 0 while real profiles write "Foot & Ankle". Every phrase containing a connector
is emitted in BOTH spellings (`connectorVariants`). Healthcare equivalents to pre-probe:
"OB/GYN" vs "OBGYN" vs "OB GYN", "L&D" vs "labor and delivery", "Peds" vs "Pediatrics".

Field paths used (person): `basic_profile.{name,headline,summary,location.state,
location.city,normalized_title.department,normalized_title.sub_department}`,
`experience.employment_details.current.{title,description,company_name,company_id,
seniority_level,start_date,company_industries,crustdata_company_id,...}`,
`experience.employment_details.past.{title,description,name,...}`,
`skills.professional_network_skills`, `honors.title`, `education.schools.{school,degree}`,
`years_of_experience_raw`.

- `basic_profile.normalized_title.department = "Sales & Revenue"` was a real precision
  weapon (2,579 → 103 on a specialty query, removing coaches and surgeons) — but as a
  hard gate it also cut real reps at a named employer (27 → 23), so: **hard when no
  employer is named, soft when one is.** Oslr: probe what normalized departments exist
  for clinical roles before assuming this gate transfers.
- `min_years_experience` → `years_of_experience_raw => N` (career years). Cardio 5+yrs
  = 1,182 live.

## 5.8 The `fields` projection

Request ONLY card-rendering fields (~25 paths) — response size and latency. Everything
the card ever shows must ride the search response: person summary/About, every current
AND past role with title, company, dates, RAW description text, logos
(`company_profile_picture_permalink` + domain for Clearbit fallback), education.
**Zero extra calls on card expand** — that raw role text is also what the grader and
evidence scanner read. (Known gap we left: `basic_profile.profile_picture_permalink`
is fetched but not mapped to the row — map the person headshot through from day one.)
Note: the projection validates strictly — `...current.company_name` filters fine but is
rejected as a projection path; include the parent object instead.

---

# Part III — Ranking, grading, and the honest zero

## 6. Deterministic ranking (runs even when the AI degrades)

Two stable sorts BEFORE the audit, so a degraded audit still shows a sane page:

1. **Match scope** (`w2-match-scope.ts`): does the PRIMARY current employment satisfy
   the title/specialty terms, or only a secondary/concurrent role? Primary first,
   stable within tiers; secondary kept but labelled on the card ("matched on a
   secondary role").
2. **Evidence tier** (`rankByAwardSeniority`): tier 0 = verbatim award evidence found
   on the profile (the exact snippet + term attached to the row → amber quote on the
   card); tier 1 = none; tier 2 = associate/trainee titles demoted on achievement asks.
   The evidence scanner reads headline, summary, skills, AND every experience entry's
   raw text — awards live in old job descriptions ("Presidents Club: 2004, 2005…").

## 7. The AI audit — grader and reranker in ONE pass

One Claude call per 25-profile chunk, **chunks in parallel** (`Promise.all`), per-chunk
failure → those rows pass unaudited (never fail the search). Each row gets
`{verdict: strong|weak|reject, reason, evidence (verbatim ≤140 chars), score: 0-100}`.
Grading and ranking are NEVER two model passes. Final sort:
`verdictTier → score desc → stable index`. Rejects are REMOVED and reported as
`waste_pct`. Verdicts+scores cached 4h beside the search row.

Prompt rules that mattered (see `w2-audit.ts` for exact text):
- Judge INTENT, not words ("sales reps" wants quota-carrying field sellers).
- Specialty families are umbrellas (spine/trauma/sports-med are siblings under ortho;
  exact vertical = strong, sibling = weak, different industry = reject).
- TENSE IS INTENT (§4) — with the fallback CONTEXT carve-out.
- Collegiate honors are NEVER professional award evidence (a university "Presidents
  Club" is academic).
- Role descriptions are FIRST-CLASS evidence — read them before saying "no evidence".
- Evidence must be copied verbatim, never invented; never reject for data not shown.
- Unfilterable intent (e.g. "might leave their job") goes to the grader as judgment
  with named positive/negative signals, quoted verbatim.

Oslr grader translations: "PGY-3" ↔ third-year resident; RN/BSN/NP/CRNA/DPM/DO/MD are
credential classes not interchangeable titles; a travel-nurse stint pattern is signal,
not noise; "at the VA" means currently employed by a VA entity.

## 8. The zero case — never a silent zero, never 263 false ones

In order, on zero results:
1. **Honest statement**: "no one currently in this role matched" + the hard-criteria
   list that had to be simultaneously true.
2. **Labelled fallback** (tense relaxation FIRST — least intent-destroying): rerun with
   past surfaces opted in, **capped at 15**, every row flagged `past_role_match`
   (badge on card), response flagged `fallback: "past_winners"`, displayed total =
   what is shown, never the provider's raw count. Grader runs in fallback context.
3. **Auto-widen ladder**, one requirement at a time, first rung with people wins,
   each demotion labelled in `relaxed[]`: award → specialty → title → seniority →
   region-to-state. Demote to SOFT, never delete — "achievers first", never
   "achievers forgotten". Empty probes are free (§5.1).
4. **User-initiated widens**: when total < 10, offer labelled `widen_options[]`
   (drop-by-id, city→state) that re-send `cached_parsed`.

## 9. Infrastructure that bit us (so Oslr ships it on day one)

- **Cache**: search results 4h, enrichments 30d, in a `crustdata_cache` table keyed on
  canonicalized criteria + limit + fields. **VERSION THE KEY**: after the tense fix
  deployed, identical criteria hit the old cache and served the old build's rows for a
  full TTL — a redeploy that changes filter SHAPE must miss old rows. Include an
  engine/query-shape version constant in the key. (Known unshipped fix in RepGPT.)
- **Credit ceiling**: hard per-session cap (6 credits) checked BEFORE each call at
  worst case (limit × 0.03); on breach return what's fetched, never call again.
  Audit verdict cache, session spend ledger, `bypass_cache` admin flag.
- **Auth**: `resolveCaller` accepts a real Supabase JWT OR `profile_id` in the body
  (localStorage passcode flow has no JWT). THE RACE: hooks that attach the id only
  after React state loads fire anonymous requests on fresh pages → 401. Resolve from
  stored session state (`localStorage`) as the fallback, and if truly absent, HOLD the
  search with "Signing you in…" instead of firing a doomed request. Reject zero-UUIDs.
- **Errors**: structured codes end-to-end (`w2-errors.ts`); the frontend maps status →
  real cause (signed out / out of credits / timed out / service error + code). A
  blanket "Unable to search" toast cost three blind debugging rounds. 180s timeout
  (real searches run 70s+), abort wired, "Try again" is a BUTTON — never auto-retry
  (a retry is a re-billed 70-second engine run).
- **Run intelligence**: log every search to the engine's OWN tables (`talent_searches`,
  `talent_search_intelligence`): raw query, parsed payload, criteria, THE REAL filter
  tree (we logged `{}` for a day — useless), result/total counts, cache hit, credits,
  audit summary, latency, `semantic_ran`/`graph_added`/`fallback` flags. Fail-soft:
  logging must never fail a search. This log is how every post-hoc audit in this
  document was possible.
- **Deploy reality (Lovable Cloud)**: code on `main` is NOT code that is running.
  Lovable mirrors files in seconds but deploys only when its agent is asked. Deploy
  message is deploy-ONLY (never invite it to "improve" code — it tidies unasked; diff
  `origin/main` after every deploy to verify nothing changed). Verify the deploy took
  by fingerprint (a field only the new build writes), not by Lovable's word.
- **Billing**: search billed per returned row; every response carries `credits` +
  `credits_session` + ceiling so the UI can show spend.

## 10. The fork doctrine

RepGPT distributor and RepGPT hiring share ZERO code — not even the Crustdata client —
by explicit decision: a shared path let a change to one silently kill the other once
(a full day and a dead product). The forked failure mode (one engine lags until a
capability is ported — semantic recall took ~15 lines) is visible and cheap; the shared
failure mode is invisible and catastrophic. **Oslr follows the same doctrine**: the new
engine is a NEW function (suggested: `search-clinicians`) beside the existing
`pdl-search`, with its own copy of the client, importing nothing from and exporting
nothing to any other engine. Frontend: its own page + its own hook; only generic UI
primitives shared (logo chain, allowlist helper — nothing search-shaped).

---

# Part IV — The Oslar adaptation

## 11. What transfers verbatim (copy, rename, keep)

The criteria contract & chips · the parse rules (§3) · company identify-first ·
autocomplete-grounded title vocabulary · the filter builder skeleton with
`connectorVariants` and the operator lab notes · the three-pass recall trio ·
match-scope + evidence-tier deterministic ranking · one-pass audit/rerank with
parallel chunks · tense doctrine + labelled fallback + auto-widen ladder ·
versioned caching, credit ceiling, resolveCaller auth, structured errors, run log ·
the fork doctrine. This is ~80% of the engine. The remaining 20% is healthcare
domain modeling below — and it is vocabulary and criteria kinds, not architecture.

## 12. The three archetypes, worked

### 12.1 "PGY-3 podiatric residents in Texas"

New criterion kind: **`training_stage`** `{profession: "podiatric", stage: "residency",
year: 3}`. Nobody's LinkedIn title is "PGY-3" alone, so triangulate — all additive,
same trio pattern:

- **Lexical**: current-title/headline OR over autocomplete-probed variants:
  "podiatric resident", "podiatry resident", "resident physician", "PGY-3", "PGY3",
  "PGY 3" (connector-variant the hyphen/space exactly like and/&), "DPM resident".
- **Year math (the real PGY signal)**: podiatric residency ≈ 3 years (PMSR/RRA).
  PGY-3 in fall 2026 ⇒ residency start ≈ summer 2024 ⇒ current residency-role
  `start_date` in a window (2024-05..2024-09), or DPM `education.schools` end_date
  ≈ 2024. Emit as a date-window leaf group; verify field support with a live probe
  first — if `start_date` range filters are weak, fetch stage-broad and let the
  deterministic layer + grader do the year from the dates on the rows.
- **Entity graph**: residency PROGRAMS are employers ("...Hospital Podiatric
  Medicine & Surgery Residency"). Company-search for podiatric residency programs
  (CRIP/CASPR program names), then `current.company_id in [ids]` — present-tense
  by construction, exactly like the foot&ankle 130-company graph.
- **Semantic**: raw sentence, mode exact, under location+profession filters.
- **Grader**: "PGY-3 = third post-graduate year. Verify stage AND year from dates on
  the profile; an attending or fellow is a reject; a PGY-2 is weak with the year
  named in the reason. Quote the date evidence." Tense doctrine: a FORMER resident
  (graduated) is a reject — unless the fallback page.
- **Location note**: residents move for training — Texas means the PROGRAM is in
  Texas (person location OR program-entity location), not their hometown.

### 12.2 "Nurses with a cardiovascular background, 5 years of experience"

- **Role-class criterion** `{class: "nurse"}` — like "reps", NOT an invented title
  list: autocomplete-probe "nurse", "RN", "registered nurse"; guard against
  drift ("nurse practitioner" is a DIFFERENT license class — if the user said
  nurses, NP inclusion is the grader's judgment call, surfaced in the reason,
  not a silent filter decision).
- **Specialty "cardiovascular"** = current surfaces only (§4), with the connector/
  abbreviation table probed live: cardiovascular / cardiac / cardio / CVICU / CCU /
  "cath lab" / "cardiac cath" / telemetry. Sibling-vertical rule in the grader
  (CVICU = exact; general ICU = weak sibling; school nurse = reject).
- **"5 years of experience"** → `years_of_experience_raw => 5` — the exact
  criterion the validator once dropped; test the chain (§3).
- **"Background"** is the tense nuance flipped: it licenses history — a nurse
  currently in cardiac rehab whose CVICU years are past still qualifies. Parse
  "background/experience in X" as specialty with history allowed; parse
  "cardiovascular nurses" (identity phrasing) as current-only. This distinction
  goes in the parser prompt with examples, and the chip note says which was applied.

### 12.3 "Orthopedic physicians at the VA"

- **The VA is an entity-resolution problem first.** One "employer" = hundreds of
  entities: "US Department of Veterans Affairs", "Veterans Health Administration",
  "VA [City] Healthcare System", individual medical centers. Build the id set ONCE:
  company-search on name variants + the department's own hierarchy, cache it as a
  named employer-group (like `MULTI_STATE_REGIONS` but for employers), emit
  `current.company_id in [ids]` — plus a name-contains OR fallback ("Veterans
  Affairs", "VA Medical Center") for entities the graph missed. NEVER bare
  `[.] "VA"` — two letters substring-matches half the index (§5.7's short-token
  guard exists for exactly this: "md" ≠ physician).
- **"Orthopedic physicians"** = specialty (current) + role-class physician
  (autocomplete: "orthopedic surgeon", "orthopaedic" — probe BOTH spellings, this
  is the and/& lesson as ae/e) + grader credential check (MD/DO; a PA in ortho is
  weak-or-reject with the credential named).
- **NPI cross-check (Oslr's unfair advantage)**: the NPPES NPI registry is free and
  queryable by name/state/taxonomy ("Orthopaedic Surgery"). Use it as a VERIFY layer
  on the card ("NPI verified · Orthopaedic Surgery · Houston TX") — the healthcare
  analog of award evidence: deterministic, quotable proof. RepGPT has nothing like
  this; it can make Oslr's precision story categorically better than Juicebox/Apollo.

## 13. New criterion kinds Oslr adds to the contract

| kind | value shape | enforcement default |
|---|---|---|
| `role_class` | `{class: "nurse"\|"physician"\|"resident"\|"app"\|...}` | hard (autocomplete-grounded) |
| `credential` | `{any_of: ["RN","BSN","NP","MD","DO","DPM","CRNA",...]}` | hard on title/education text; grader verifies |
| `training_stage` | `{profession, stage, year}` | hard (title+date triangulation) |
| `employer_group` | `{name: "VA", company_ids: [...], name_variants: [...]}` | hard |
| `care_setting` | `{setting: "hospital"\|"ASC"\|"clinic"\|"home health"\|...}` | soft first; probe industry taxonomy before promising hard |

**The great inversion — flag every employer-class rule you port:** RepGPT hiring
EXCLUDES care-delivery organizations (hospitals, health systems, clinics — "not
commercial hiring targets", `provider-employers.ts`). For Oslr those are exactly the
population. Port that module as an INCLUDE/classify list, not an exclude list, and
grep every ported file for the exclusion before first run — this is the single
easiest catastrophic copy-paste bug in the whole adaptation.

## 14. Build order (the sequence that worked for RepGPT hiring)

1. **Probe before building** (free/cheap): autocomplete the clinical vocabulary;
   run hand-built filter trees for all three archetypes via the API directly;
   measure counts; find the healthcare "and/&"-class surprises. One evening,
   almost free, and it de-risks everything after. Log every probe result into
   this file's successor.
2. Scaffold `search-clinicians` from the search-talent skeleton: client copy,
   criteria contract with §13 kinds, parser prompt with the three archetypes as
   in-prompt examples, builder, single search path, run log. Deterministic only.
3. Live acceptance battery (the RepGPT method): emit the tree from YOUR modules
   under Deno, execute it against the live API, eyeball rows, fix, re-measure.
   Keep a defect ledger with before/after counts — it becomes the vendor handback.
4. Add the recall trio (autocomplete vocab → semantic → entity graph), each additive
   and fail-soft.
5. Add ranking + the one-pass audit with the healthcare grader rules.
6. Zero-case machinery (fallback + ladder), widen actions, chips UI.
7. NPI verify layer on the card.
8. Gate to allowed accounts, deploy, shakedown search, THEN widen access.

Every stage above has working, live-verified reference code in
`incirqle-ai/supabase/functions/search-talent/` — read it beside this document.

---
*Blueprint distilled from the RepGPT hiring engine build, 2026-09-09 → 09-11:
19+ commits, 13 live-measured defect fixes, 10 verified query families.
Companion artifact: the Crustdata handback package (repgpt-hiring-handback-2026-09-11.zip)
carries the same engine's code and the vendor-facing findings.*
