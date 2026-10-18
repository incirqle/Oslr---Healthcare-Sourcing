# Oslr criteria, ranking, review and analytics: build spec

Version 1, 2026-10-18. For a Claude Code session working in the Oslr repo.
Companion demo: `oslr-criteria-demo.html` (same folder). The demo runs the same scoring logic as section 7 (its copy takes results as an id-keyed map instead of an array; the arithmetic is identical and is tested against the section 12 fixtures).

## 0. Sources and decisions

Read for this spec (Oslr zip of 2026-10-17):
- Engine: `supabase/functions/_shared/clinician-engine/` `clinician-criteria.ts`, `handler.ts` (row normalization ~965-1045, set-aside and response ~1130-1290), `audit.ts`, `soft-rank.ts`, `match-scope.ts`, `employment-model.ts`, `military-affiliation.ts`, `noise-filter.ts`, `clinical-vocabulary.ts`, `credit-budget.ts`.
- Adapter: `supabase/functions/search-people/index.ts` (`relevanceScore`, `toSearchPageRow`), `refine-filters.ts`.
- UI: `src/pages/SearchPage.tsx` (`mapRow` ~268-298), `src/components/search/SearchResults.tsx`, `FilterReview.tsx`, `FitPill.tsx`, `match-chips.ts`, `candidate-insights.ts`, `src/hooks/useCandidateFit.ts`, `src/index.css`, `tailwind.config.ts`.
- Juicebox teardown in this folder: `docs/ranking-logic.md`, `docs/ui-spec.md`, `docs/juicebox-vs-oslr.md`.

Decisions from Steven (2026-10-17), binding on this spec:
- The per-search stats page is called **Analytics**, not Insights.
- Criteria ranking is dynamic: any number of criteria, drag to reorder.
- No hospital privileges filter or claim. No NPI dependency.
- Private practice is Oslr's existing `employment_model`. State licensure is a priority but has no data source yet (out of scope here, listed in section 14).
- The engine is ahead of Juicebox; the UI is behind. This spec closes the UI gap without weakening the engine.

Not verified: no live CrustData run was made for this spec. Field names on rows come from the code, not from a captured response.

## 1. The problem in one paragraph

The engine computes, per candidate: grader verdict, reason, verbatim evidence, absolute score, training-stage date fit, primary vs secondary match, employment-model read with evidence, military read with evidence, a location transfer note, and a subspecialty or credential evidence snippet. It also returns every set-aside row with its reason (`hidden_results`, `filtered`). The browser keeps only `relevance_score` and `military_affiliation` (`SearchPage.tsx mapRow`), and the drawer's "why it matched" chips are re-derived in the browser by fuzzy string matching (`match-chips.ts buildMatchChips`). The recruiter never sees the engine's work. Juicebox shows less intelligence but shows all of it.

## 2. Vocabulary (use these words in code and UI)

| UI word | Meaning | Engine source |
|---|---|---|
| **Required** | Enforced in the search. Failing it removes the candidate. | `SearchCriteria.enforcement === "hard"` |
| **Preferred** | Ranks candidates. Order sets weight. | `enforcement === "soft"` plus user-added ranking criteria |
| **Must-have** | A Preferred criterion the user locked. A clear No sets the candidate aside. | new flag `must_have` on a ranking criterion |
| **Can't check** | Stated by the user, not expressible with our data. Shown struck through, never silently dropped. | `enforcement === "dropped"` (`kind: "unsupported"`) |
| **Set aside** | Kept out of results with a reason, viewable in its own tab. | `hidden_results` + `filtered` breakdown |

Verdict per criterion per candidate, four values only:

| Value | UI label | Meaning |
|---|---|---|
| `met` | Yes | Evidence on the profile satisfies it |
| `partial` | Partly | Adjacent or secondary evidence (sibling subspecialty, secondary role, adjacent training year) |
| `unknown` | Not shown | The profile does not say either way |
| `not_met` | No | The profile contradicts it |

`unknown` exists because Oslr's audit rule is "never reject for missing data you were not shown" (`audit.ts`). Juicebox folds this into Maybe; we keep it separate because "board certification not stated" and "partly fits" are different things to a recruiter.

## 3. Data contract

### 3.1 Ranking criterion (new, travels with the search)

```ts
// supabase/functions/_shared/clinician-engine/ranking-criteria.ts (new)
export type RankingOrigin = "parsed" | "user" | "suggested";

export interface RankingCriterion {
  /** Stable id. For parsed soft criteria reuse SearchCriteria.id ("c4"). User-added: "u" + nanoid(8). */
  id: string;
  /** Full text as the user would read it. */
  text: string;
  /** 1-2 word column label ("Fellowship", "Robotic"). Generated once, editable. */
  title: string;
  /** 0 = most important. Array order is the source of truth; this mirrors it. */
  position: number;
  must_have: boolean;
  origin: RankingOrigin;
  /** Set when the criterion maps to an engine kind with a deterministic resolver (section 4). */
  kind?: CriterionKind;
  /** The SearchCriteria it came from, when origin === "parsed". */
  source_criterion_id?: string;
}
```

Required criteria stay as `SearchCriteria` with `enforcement: "hard"`. They are not RankingCriteria and carry no weight. They still get a per-candidate result (always `met` for kept rows, by definition) so the table can show them as a fixed left block.

### 3.2 Per-candidate results (new field on every row)

```ts
export type CriterionStatus = "met" | "partial" | "unknown" | "not_met";
export type ResultSource = "rule" | "grader";

export interface CriterionResult {
  criterion_id: string;          // RankingCriterion.id or SearchCriteria.id
  status: CriterionStatus;
  source: ResultSource;          // "rule" = deterministic, "grader" = AI
  evidence: string | null;       // verbatim from the profile, <= 160 chars
  section: string | null;        // section id from 6.2 ("cur0", "exp2", "edu1", "headline")
  explanation: string | null;    // one sentence, filled lazily (section 6.4)
}

// added to the row object returned by handleClinicianSearch
interface RankedRowFields {
  criteria_results: CriterionResult[];
  match_rate: number;            // 0-100, section 7
  match_breakdown: { criterion_id: string; points: number; max: number }[];
}
```

### 3.3 Response additions (`handler.ts` response body)

```ts
ranking_criteria: RankingCriterion[];   // ordered
required_criteria: SearchCriteria[];    // the hard ones, for the readback
cant_check: SearchCriteria[];           // the dropped ones
ranking_version: 1;
```

`results` and `hidden_results` rows both carry `criteria_results`. Hidden rows add `set_aside_reason` (section 8).

## 4. Deterministic resolvers (no AI, no credits)

One pure function per criterion kind, in `ranking-criteria.ts`. Each returns a `CriterionResult` or `null` (null means "ask the grader"). Every field read below already exists on the row today.

| Kind | Reads | met | partial | not_met | null (grader) |
|---|---|---|---|---|---|
| `location` | `location_locality`, `location_region`, `location_note` | locality/region inside the value | `location_note` present (facility-tagged, transferred) | outside | no location on row |
| `employer_group`, `company` | `job_company_name`, `current_employers[]` | primary employer matches | matches a non-primary current employer | n/a (hard filter) | n/a |
| `role_class` | `match_scope` | `primary` | `secondary` | n/a | n/a |
| `training_stage` | `stage_fit` | `in_window` | n/a | `out_of_window` | `unknown` |
| `specialty` with `subspecialty` | `evidence_snippet`, `evidence_term` | snippet present and term in subspecialty terms | n/a | n/a | no snippet |
| `credential` | `evidence_snippet` | term in `any_of` | n/a | n/a | no snippet |
| `fellowship` | `evidence_snippet`, education | "fellow" in an education record or past title | n/a | n/a | otherwise |
| `employment_model` | `employment_model`, `employment_model_evidence` | read === asked | n/a | read is the other model | read === "unknown" |
| `experience` | `experience_history` start dates | inside range | within 1 year of range | outside by more | no dates |
| `tenure` | `job_start_date` | inside range | within 1 year | outside by more | no date |
| `employer_size` | primary employer `headcount` | inside range | n/a | outside | headcount 0 or null |
| `care_setting` | `job_company_name` vs `employer_name_terms`, role text | employer name hit | role-text hit only | n/a | otherwise |

Evidence for rule results: the field value that decided it, quoted ("Started Jul 2024, fits PGY-3 window", "employment model: private_practice (owner title at a 14-person practice)"). `source: "rule"`.

For Required criteria on kept rows, set `status: "met"` with the same evidence. Do not re-judge them.

## 5. The grader change (one pass, same call count)

Today `runClinicianAudit` returns per profile `{ i, verdict, score, reason, evidence }`. Extend, do not replace.

### 5.1 User message

Add a block after `ENFORCED FILTERS` in `buildAuditUserMessage`:

```
RANKING CRITERIA (judge each one per profile):
[p0] Fellowship trained in adult reconstruction
[p1] Robotic-assisted arthroplasty experience
[p2] 5+ years in practice after fellowship
```

Only criteria whose resolver returned `null` for at least one row in the chunk are listed. Ids are the RankingCriterion ids.

### 5.2 Profile block section ids

`auditProfileBlock` labels each line so evidence can cite it. Current lines get prefixes:

```
[headline] ...
[cur0] current: Orthopaedic Surgeon @ Harpeth Valley Orthopedics (started 2014-08)
[cur1] ...second current employer
[exp0] past role ...
[edu0] Adult Reconstruction Fellowship, Rush University Medical Center
[summary] ...
```

`past roles` and `education` change from one joined line to one line per entry (current code joins with `; `). Keep the existing caps (5 past roles, 4 education).

### 5.3 Output schema addition (append to `AUDIT_SYSTEM_PROMPT`)

```
- For every RANKING CRITERIA id, add an entry to "criteria":
  {"id": "<id>", "status": "yes"|"partly"|"not_shown"|"no", "evidence": str|null, "section": str|null}
  yes = the profile shows it; partly = adjacent evidence (name it); not_shown = the profile does not say;
  no = the profile contradicts it. evidence is verbatim, under 140 characters. section is the [id] of the
  line the evidence came from. Never answer "no" for missing data; that is "not_shown".
```

Final JSON per profile:
`{"i", "verdict", "score", "reason", "evidence", "criteria": [{id, status, evidence, section}]}`

`parseAuditVerdicts` maps `yes|partly|not_shown|no` to `met|partial|unknown|not_met`, drops unknown ids, truncates evidence to 160 characters, and defaults a missing entry to `unknown`. A malformed `criteria` array never invalidates the row's overall verdict.

### 5.4 Cost

Same number of LLM calls. Output tokens grow by roughly 40 tokens per criterion per profile. No CrustData credits. Log `criteria_tokens_est` in `logClinicianRun`.

## 6. Re-ranking without re-searching

### 6.1 Reorder, toggle must-have, remove

Pure client recompute with the section 7 function. No request, no credits, instant.

### 6.2 Add a criterion after results are in

New action on `search-people`: `{ action: "rank_criteria", run_id, criteria: RankingCriterion[] }`.
- Reads the cached kept and hidden rows for `run_id` (the audit cache already stores verdicts per row; extend the cached shape with `criteria_results`).
- Runs resolvers, then one grader pass over rows with `null` results for the new criterion only (chunked and parallel, as today).
- Returns `{ criteria_results_by_row: Record<rowId, CriterionResult[]> }`.
- Cache key: `clin:crit:${run_id}:${sha1(criterion.text.toLowerCase().trim())}`. The same criterion text on the same run never re-grades.
- UI shows the new column in a "Checking 37 profiles" state, then fills cells as the response lands.

### 6.3 Short titles

Generated in the same call as 6.2 (or in the parse pass for parsed soft criteria): ask for a 1-2 word title per criterion. Fallback: first noun phrase of the text, title-cased, max 14 characters.

### 6.4 Explanations

`explanation` is filled only for the rows visible on the current page or open in Review, by a lazy `{ action: "explain_criteria", run_id, row_ids }` call (Juicebox does the same: explanations for 15 rows at a time). Until it lands, the UI shows the evidence quote, which is already enough to read.

## 7. Scoring (the formula, verified by the demo's test run)

Preferred criteria only. Required criteria are gates, not points.

```ts
export const STATUS_CREDIT: Record<CriterionStatus, number> = {
  met: 1, partial: 0.5, unknown: 0.25, not_met: 0,
};

/** Weight of the criterion at position i of n. Linear, visible in the UI. */
export function weightAt(i: number, n: number): number {
  return n - i;                 // n=4 -> 4,3,2,1 (40%, 30%, 20%, 10%)
}

export function scoreRow(results: CriterionResult[], ranking: RankingCriterion[]) {
  const n = ranking.length;
  if (n === 0) return { match_rate: null, breakdown: [], must_have_failed: [] };
  const byId = new Map(results.map((r) => [r.criterion_id, r]));
  let got = 0, max = 0;
  const breakdown = [];
  const must_have_failed: string[] = [];
  ranking.forEach((c, i) => {
    const w = weightAt(i, n);
    const status = byId.get(c.id)?.status ?? "unknown";
    const pts = w * STATUS_CREDIT[status];
    got += pts; max += w;
    breakdown.push({ criterion_id: c.id, points: pts, max: w });
    if (c.must_have && status === "not_met") must_have_failed.push(c.id);
  });
  return { match_rate: Math.round((got / max) * 100), breakdown, must_have_failed };
}
```

Why these numbers, and how they differ from Juicebox (whose formula is in `docs/ranking-logic.md`):
- Juicebox weights 6:5:4 for three criteria, so order barely matters. Ours is 3:2:1 for three, so the top criterion counts three times the bottom one. The percentages are shown in the criteria panel, so the user knows what dragging does.
- Juicebox has no "not shown" state; a missing board certification is a Maybe worth about half. Ours gives `unknown` a quarter, so a candidate who simply did not list something ranks below one with partial evidence and above one who clearly lacks it.
- Must-have is ours only. A `not_met` on a must-have moves the row to Set aside with reason `must_have`. An `unknown` on a must-have keeps the row and flags the cell.

Sort order of kept rows:
1. `match_rate` descending (null when there are no Preferred criteria; then skip to 2)
2. grader tier: strong, weak, unaudited (`auditTier`)
3. `audit_score` descending
4. existing deterministic index (the five-tier sort in `soft-rank.ts rankDeterministic` already ran server-side; preserve its order as the final tiebreak)

When the user has added no Preferred criteria, the page shows today's order and a "Match" column is hidden, not shown as 100%.

## 8. Set aside

Rows in `hidden_results` keep their existing reasons. Map the `filtered` keys to UI labels and add one new key:

| Key (existing unless noted) | UI label | Reason line source |
|---|---|---|
| `grader` | Didn't fit on review | `audit_reason` |
| `employment_model` | Wrong employer type | `employment_model_evidence` |
| `military_reserve` | Guard or Reserve, civilian primary job | `military_evidence` |
| `thin_profile` | Too little on the profile | thin-profile reason |
| `duplicates` | Likely duplicate | dedupe note |
| `role_class_noise` | Not a clinician in this role | `audit_reason` ("Not a surgeon...") |
| `must_have` (new) | Failed a must-have | "No on: {criterion title}" + that result's evidence |

Each hidden row gets `set_aside_reason: keyof filtered | "must_have"` and `set_aside_note: string`. A "Restore" action moves one row back into results for this session only (client state), labelled "Restored by you".

## 9. Screens

All screens use the existing app tokens (`src/index.css`): Inter body, DM Sans display, seafoam `--primary`, navy sidebar, `--radius: 0.625rem`, `--success` and `--warning` for verdicts. Verdicts never rely on color alone: each pill carries an icon and a word.

### 9.1 Query readback (top of results)

The user's sentence, then one line of chips:

> **Required:** Orthopedic surgeons · Joint reconstruction · Greater Nashville · Private practice
> **Preferred:** Fellowship (40%) · Robotic (30%) · 5+ yrs (20%) · Outpatient joints (10%)
> **Can't check:** ~~publishing on arthroplasty~~ (tooltip: "Oslr has no publication data yet. This was not used to filter or rank.")

Click a Required chip: opens the filter editor at that field. Click a Preferred chip: opens the Criteria panel. Counts beside the heading: `24 matches · 13 set aside`.

### 9.2 Criteria panel (side sheet, 420px)

- Header "Ranking criteria", subhead "Drag to set importance. Weights update as you drag."
- Ordered list. Each row: drag handle, position number, text (inline editable), weight percentage, must-have toggle (lock icon, label "Must-have"), remove.
- Keyboard: the handle is a button; Up/Down arrows move the focused row. Touch: long-press drag.
- "Suggested for this search" list below, healthcare-specific, generated from the parse (examples: "Revision arthroplasty", "Outpatient or ASC total joints", "Direct anterior hip approach", "Accepting call at a Level II trauma center").
- "Add criterion" field. Placeholder rotates real examples: "Trained at an adult reconstruction fellowship", "Not currently at a hospital-owned group", "Started practice after 2015".
- Footer: "Apply" (reorders and toggles are applied live; Apply only matters for added or edited text, which triggers 6.2).

### 9.3 Results: list view

Card per candidate, existing card layout kept (`SearchResults.tsx` MiddleColumn, ContactIcons, FitPill). Added under the role line:

- Match percentage and a thin segmented bar (one segment per Preferred criterion, filled by credit).
- One line per Preferred criterion: verdict pill (`Yes` / `Partly` / `Not shown` / `No`) with the short title, then the evidence quote in muted text. Max 4 lines; "+2 more" expands.
- Engine tags already computed, now rendered: `Primary role` or `Matched on a side role`, training-year fit (`Started Jul 2024, fits PGY-3`), employment model, military, location note.
- Grader reason as a single muted sentence at the bottom.

### 9.4 Results: table view

- Sticky left: checkbox, name, title, employer, location.
- Fixed Required block (narrow, all checks, collapsible to one "Required" column).
- Match column (number plus bar), sortable.
- One column per Preferred criterion in importance order, header = short title + weight. Cell = verdict icon tinted by status. Hover or focus shows the evidence quote and section.
- Column header click sorts by that criterion (met > partial > unknown > not_met, then match).
- Shortlist status column (existing `FitPill`).
- Horizontal scroll inside the table container only.

### 9.5 Set aside tab

Grouped by reason (section 8), each group collapsible with a count. Each row: name, title, employer, the reason line, "Restore". Header copy: "Kept out of your results, with the reason. Restore anyone you want to look at."

### 9.6 Review mode

Full-screen modal, opened from "Review" or by clicking a name.
- Left (60%): profile with tabs Experience, Education, Skills. Lines that are cited as evidence are highlighted, keyed by section id.
- Right (40%): "Criteria" list: verdict pill, full text, evidence quote, explanation (lazy, 6.4), citation chip that scrolls the left pane to the section.
- Footer: Previous (K), Next (J), Good fit (G), Maybe (M), Not a fit (X), Shortlist (S). G, M and X map to the existing `FitStatus` values `good | maybe | not` in `useCandidateFit.ts` and advance to the next profile. S adds the candidate to the current project (the existing `SaveToProjectDialog` flow, defaulting to the search's project).
- Progress: "8 of 24 reviewed".

### 9.7 Analytics tab (per search)

Name: "Analytics". It lives inside the search page next to "Results" and "Set aside". The sidebar's account-level Analytics section (Outreach, Projects, Usage) is unrelated and keeps its name.

All widgets compute client-side from `results` and `hidden_results` with one pure function, `buildSearchAnalytics(results, hidden, required, ranking)`. No extra request, no credits.

| Widget | Computation |
|---|---|
| Funnel | `provider_total` → rows fetched (`lexical_fetched` when echoed, else results+hidden) → kept after Required → met every must-have → match ≥ 75. Set-aside count per reason as a side list. |
| Criteria coverage | For each Preferred criterion: count of met / partial / unknown / not_met across kept rows. Stacked horizontal bars in importance order. This is the "which criterion is cutting my pool" view. |
| Match distribution | Kept rows bucketed 0-24, 25-49, 50-74, 75-100. |
| Employer type | `employment_model` read counts (private practice / hospital-employed / unknown) across kept + hidden. |
| Subspecialty evidence | For subspecialty asks: rows with a rule-sourced `met` vs grader-sourced vs none. |
| Years in practice | From earliest `experience_history` start after training: buckets 0-4, 5-9, 10-19, 20+. |
| Where they are | Top cities from `location_locality` with counts. |
| Training programs | Top `education[].school_name` where degree or title contains "fellow" or "residen". |
| Military | Counts by `military_affiliation` when any row has one; hidden otherwise. |

Charts follow the app tokens; status colors are the verdict colors from 9.3 and never reused for categories.

## 10. Wiring the data the UI already receives (phase 1, no engine change)

In `SearchPage.tsx mapRow`, add to `Candidate` (and the type in `SearchResults.tsx`):

```ts
audit_verdict: r.audit_verdict ?? null,
audit_reason: r.audit_reason ?? null,
audit_evidence: r.audit_evidence ?? null,
audit_score: r.audit_score ?? null,
match_scope: r.match_scope ?? null,
stage_fit: r.stage_fit ?? null,
employment_model: r.employment_model ?? null,
employment_model_evidence: r.employment_model_evidence ?? null,
military_evidence: r.military_evidence ?? null,
evidence_snippet: r.evidence_snippet ?? null,
soft_matches: r.soft_matches ?? [],
criteria_results: r.criteria_results ?? [],   // empty until phase 2
match_rate: r.match_rate ?? null,
```

Render the grader reason, evidence quote and engine tags on the card (9.3). Replace `buildMatchChips` in `CandidateDrawer.tsx` with chips built from `criteria_results` when present, falling back to the current function when empty. Render `hidden_results` in the Set aside tab using `filtered`.

## 11. Build phases

| Phase | Scope | Files | Done when |
|---|---|---|---|
| 1 | Show what we already compute | `SearchPage.tsx`, `SearchResults.tsx`, `CandidateDrawer.tsx`, new `SetAsideTab.tsx` | Cards show reason, evidence and engine tags; Set aside tab lists hidden rows by reason |
| 2 | Per-criterion results | new `ranking-criteria.ts`; `audit.ts` (5.1-5.3); `handler.ts` (attach `criteria_results`, response 3.3); `search-people/index.ts` passthrough | Every kept row has one result per Required and Preferred criterion; unit tests in 12 pass |
| 3 | Criteria panel, list lines, table view | new `CriteriaPanel.tsx`, `QueryReadback.tsx`, `ResultsTable.tsx`; `FilterReview.tsx` folds into `QueryReadback` | Reorder and must-have recompute instantly; table sorts by any criterion |
| 4 | Add criterion after search | `search-people/index.ts` action `rank_criteria`; cache | New column fills without a CrustData call |
| 5 | Review mode | new `ReviewMode.tsx`; section-id highlighting | All keyboard actions work; fit writes to `candidate_fit` |
| 6 | Analytics | new `buildSearchAnalytics.ts`, `SearchAnalytics.tsx` | All widgets render from a cached run with no request |

## 12. Tests

`ranking-criteria.test.ts`:
1. `scoreRow` with n=4, statuses [met, met, met, met] → 100.
2. [met, not_met, unknown, partial] → (4 + 0 + 0.5 + 0.5) / 10 = 50.
3. Same four results, the first criterion dragged to last (statuses now [not_met, unknown, partial, met] against weights 4,3,2,1) → (0 + 0.75 + 1 + 1) / 10 = 27.5, rounds to 28.
4. must-have `not_met` → appears in `must_have_failed`; `unknown` does not.
5. Resolver `training_stage`: `stage_fit` `in_window` → met; `out_of_window` → not_met; `unknown` → null.
6. Resolver `employment_model`: read equals asked → met with evidence string; `unknown` → null.
7. `parseAuditVerdicts` with a `criteria` array containing an unknown id and a bad status → those entries dropped, overall verdict intact.
8. Missing `criteria` key in grader output → every Preferred result `unknown`, row kept.

`buildSearchAnalytics.test.ts`: funnel totals add up (kept + hidden = fetched); coverage counts per criterion sum to kept rows.

## 13. Copy rules for this UI

- Criterion verdict words: Yes, Partly, Not shown, No. "Maybe" is used only for the recruiter's own fit call (existing `FitStatus`), never for an engine verdict.
- Tabs: Results, Set aside, Analytics.
- No "AI-powered", "smart", or "magic". Say what it checked.
- No em dashes in any UI string.

## 14. Out of scope, named

- State licenses: no data source. When one exists it becomes a Required kind with a rule resolver.
- Publications ("publishing on joint reconstruction"): no data source. Stays in Can't check. A shortlist-only publication lookup is a separate spec.
- Board certification: only as a Preferred criterion judged from profile text (grader), never Required.
- Hospital privileges: not built, by decision.
- Explanation generation cost model (6.4) is an estimate until measured.

## 15. Addendum, 2026-10-18 (Steven)

- The ranked criteria table (9.4) is the DEFAULT results view. The card list (9.3) is the alternate view behind a Table / List toggle; the choice is remembered per user in localStorage (wrapped in try/catch).
- Criteria are draggable in two places: the Criteria panel (9.2) and the table's criterion column headers. Dragging a header reorders the criteria, updates the weights, and recomputes the match column instantly with no request.
- Note on test 2 in section 12: (4 + 0 + 0.5 + 0.5) uses unknown = 0.25 x 2 = 0.5 and partial = 0.5 x 1 = 0.5, total 5 of 10 = 50. Test 3: not_met 0 x 4, unknown 0.25 x 3 = 0.75, partial 0.5 x 2 = 1, met 1 x 1 = 1, total 2.75 of 10 = 27.5, rounds to 28.
