
# Wellspan Ortho — Precision Plan (One-Pass)

## What the logs prove

For `orthopedic surgeons at Wellspan Health`:

```
Parsed:        specialties: ["orthopedics", "surgery"]    ← biggest leak
               required_keywords: 8 ortho terms + "surgeon"
PDL Query:     filter: 4 | must: 2 | should: 69 | must_not: 104
               Industry OR: hospital&healthcare, medical practice, health/wellness/fitness
               Location: pennsylvania (inferred from HQ ✅)
               Company: 25 clauses (1 id, 1 name, 19 alt names, 1 affiliated id, *wellspan health*)
               Role gate: sub_role:doctor OR ONET Physicians/Surgeons
               Specialty: kw cluster on title.text/summary/headline/skills/sub_role + wildcard *ortho*
Result:        491 candidates
Rerank:        anchorMode=true, 0.25/0.75 blend, 15/15 scored ✅
```

The funnel is leaking on **specialty**, not on company or current/past tenure (those are now correct). 491 PA-located clinicians at Wellspan-named entities is not 491 orthopedic surgeons — most are general/vascular/cardiac/neuro/etc. surgeons plus any clinician whose summary mentions "surgery."

## Root causes by stage

| # | Stage | Leak |
|---|---|---|
| 1 | `parse-query.ts` L2 Claude | Returned `specialties: ["orthopedics","surgery"]`. "Surgery" is a *category*, not a specialty — it OR-matches every surgeon. |
| 2 | `build-pdl-query.ts` keyword cluster | `mustHaveSpecialty` builds OR across `title.text`, `summary`, `headline`, `skills`, `sub_role`, and `wildcard:*root*` for each of the top-8 keyword terms. With "surgery" in the list, this gate is satisfied by ANY surgeon. |
| 3 | `build-pdl-query.ts` required_keywords | Parser packed `"surgeon"` and `"attending surgeon"` into `required_keywords` — same OR-leak as above. |
| 4 | `build-pdl-query.ts` company clause | `wildcard: *wellspan health*` on `job_company_name` lets in any company whose name contains the phrase (e.g. confusable affiliates). 25 OR clauses total — broad. |
| 5 | `build-pdl-query.ts` industry filter | `medical practice` and `health, wellness & fitness` are low-precision industries; not needed when we already have a resolved company hard filter. |
| 6 | `build-pdl-query.ts` ortho expansion | Adds 13 ortho synonym titles as **soft** boost only — doesn't tighten recall (correct), but the role gate (`sub_role:doctor` OR `ONET Physicians/Surgeons`) is wide-open to non-ortho surgeons. No ortho ONET filter applied. |
| 7 | `ai-rerank.ts` | Anchor rule (`employer_id NOT in ANCHOR_COMPANY_IDS → ≤25`) exists, but there's **no specialty rule**. A vascular surgeon at Wellspan scores high on title+employer signals. |
| 8 | `index.ts` audit | We persist `ai_rerank` meta but not the parsed `specialties` array or the count by ONET — so this leak is invisible until someone reads logs. |

---

## Fixes (single PR)

### G1 — Strip generic category terms from parsed `specialties`  *(parse-query.ts)*

Post-parse normalization: drop generic surgical/medical categories when a more-specific specialty is present.

```ts
const GENERIC_SPECIALTY_CATEGORIES = new Set([
  "surgery", "medicine", "internal medicine", "general surgery",
  "primary care", "clinical"
]);
const specs = parsed.specialties ?? [];
if (specs.length > 1) {
  const specific = specs.filter(s => !GENERIC_SPECIALTY_CATEGORIES.has(s.toLowerCase()));
  if (specific.length > 0) parsed.specialties = specific;
}
```

Also drop bare role words from `required_keywords` (`surgeon`, `physician`, `attending`, `attending surgeon`, `surgical physician`) — they're already encoded as titles and only widen the OR.

### G2 — Specialty gate must use a SPECIFIC term  *(build-pdl-query.ts ~620-640)*

In `mustHaveSpecialty`, exclude `sub_role:lower` and `wildcard:*root*` for any term where `root.length < 6` OR the term is in `GENERIC_SPECIALTY_CATEGORIES`. Keep `summary`/`headline`/`skills` only for the *first* specialty term (the canonical one), not all 8 keyword terms. This prevents "surgery" or "medicine" from satisfying the gate.

### G3 — Add ortho-specific ONET as a hard filter when ortho intent detected  *(build-pdl-query.ts, near role gate ~947)*

When `orthoSignal === true` AND `hasResolvedCompanyAnchor`, replace the wide `sub_role:doctor / ONET Physicians|Surgeons` gate with:

```ts
filterClauses.push({ bool: { should: [
  { term: { job_onet_specific_occupation: "Orthopedic Surgeons" } },
  { term: { job_onet_specific_occupation: "Orthopedic Surgeons, Except Pediatric" } },
  { term: { job_onet_specific_occupation: "Pediatric Surgeons" } },        // pediatric ortho often lands here
  { term: { job_title_sub_role: "orthopedic surgeon" } },
  { wildcard: { job_title: "*orthop*" } },                                  // catches *ortho*, *orthopaedic*
  { match_phrase: { headline: "orthopedic surgeon" } },
  { match_phrase: { headline: "orthopaedic surgeon" } },
  { match_phrase: { summary:  "orthopedic surgeon" } },
] } });
```

Add a parallel hard exclusion for other surgeon ONETs (vascular, cardiothoracic, neurological, oral, plastic, general) when ortho intent is high-confidence:

```ts
mustNot.push({ term: { job_onet_specific_occupation: "Cardiothoracic Surgeons" } });
mustNot.push({ term: { job_onet_specific_occupation: "Neurological Surgery Physicians" } });
mustNot.push({ term: { job_onet_specific_occupation: "Vascular Surgeons" } });
mustNot.push({ term: { job_onet_specific_occupation: "Oral and Maxillofacial Surgeons" } });
mustNot.push({ term: { job_onet_specific_occupation: "Plastic Surgeons" } });
// NOT general surgeons — too many ortho profiles get tagged "Surgeons, All Other"
```

Generalize by routing through a `SPECIALTY_ONET_MAP` keyed on parsed specialty (`orthopedics`, `cardiology`, `neurology`, …) so this also tightens future anchored searches.

### G4 — Drop the company wildcard and the low-precision industries when anchor is resolved  *(build-pdl-query.ts ~440, ~689)*

When `hasResolvedCompanyAnchor === true`:
- Skip `resolvedWildcards` — the 19 alt names + 1 affiliated ID + canonical name are already in the OR; the wildcard adds noise.
- In `industryClauses`, keep `hospital & health care` + `medical practice` but drop `health, wellness & fitness` (gym chains, supplements, alt-med).
- Reduce alt-name slice from 30 → 12 to prevent a long-tail brand alias from hijacking the OR.

### G5 — Tighten the resolver's affiliated-IDs gate  *(build-pdl-query.ts ~435 — and resolver in index.ts)*

Only include `resolvedAffiliatedIds` when the affiliated company shares the anchor's HQ region. Today affiliated_profiles can pull in cross-state subsidiaries. Easy filter: skip affiliated IDs whose HQ state differs from `_resolved_company_hq_state`.

### G6 — Add specialty rule to AI reranker  *(ai-rerank.ts SYSTEM_PROMPT + buildIntentSummary)*

In `buildIntentSummary`, pass `REQUIRED_SPECIALTY` (the first canonical specialty after G1).
In the prompt, add:

> If `REQUIRED_SPECIALTY` is "orthopedics" (or similar), candidates whose ONET, sub_role, and title/headline/summary contain NO ortho signal MUST score ≤ 25. A vascular surgeon at the anchor employer is NOT a match.

In `buildBrief`, surface `job_onet_specific_occupation` and `job_title_sub_role` (currently only `sub_role` is included) so the LLM can apply the rule.

### G7 — Persist specialty + ONET histograms in audit  *(index.ts audit write)*

Extend the existing `ai_rerank` meta block:

```json
"specialty_funnel": {
  "parsed_specialties": ["orthopedics"],
  "ortho_intent": true,
  "onet_distribution": { "Orthopedic Surgeons": 38, "Vascular Surgeons": 12, ... },
  "company_id_match_pct": 0.94
}
```

Compute from the formatted candidate pool before pagination. One SQL query (`select meta->'specialty_funnel' from search_audit_logs …`) will then show whether the next regression is specialty leak, employer leak, or location.

### G8 — UI: show specialty filter chip with count  *(SearchResults.tsx header strip)*

Render `Specialty: orthopedics (38 ortho-tagged of 47 shown)` next to the existing rerank-state line so the recruiter sees the precision figure without opening the drawer. Pure presentational; reads from G7's audit meta passed through the response.

---

## Sequencing in one PR

```text
G1 ──► G2 ──► G3 ──► G4 ──► G5 ──► G6 ──► G7 ──► G8
parse  gate   ONET   anchor aff.   rerank audit  UI
```

G1+G2 alone should cut the pool from 491 to ~80 (only candidates with real orthopedic signal). G3+G4+G5 trim to ~30-50 actual Wellspan orthopedists. G6 makes top-15 ranking specialty-correct. G7+G8 make the next regression a one-query diagnosis.

## Verification

1. Re-run the same query → expect total ≤ 80, top 15 all ortho.
2. `select meta->'specialty_funnel' from search_audit_logs order by created_at desc limit 1;` → `onet_distribution.Orthopedic Surgeons` should be ≥ 60% of pool.
3. Re-run for `cardiologists at Cleveland Clinic` → confirm G3's `SPECIALTY_ONET_MAP` routing works for a different specialty (regression check).
4. Re-run for `nurse practitioners at Mass General` → confirm G3 doesn't fire (not a doctor query) and the existing NP path is unchanged.

## Out of scope

- L2 Claude prompt tightening (would also fix G1 at source, but text change deserves its own eval).
- Company resolver overhaul — G5 is a narrow gate, not a rewrite.
- Reranker model swap.

## Risk

- G3 could under-recall for orthopedists whose PDL profile has neither ortho ONET nor "ortho" in the title (rare — these usually have ortho in headline/summary, which G3 still catches).
- G4 dropping `health, wellness & fitness` is safe for hospitals but would hurt searches like "wellness coach at Equinox" — mitigated because that branch only fires when `hasResolvedCompanyAnchor === true` AND anchor is in healthcare.
- Cascade fallback in `index.ts` (omitSpecialtyMust) still works — G2/G3 only run on the first pass.
