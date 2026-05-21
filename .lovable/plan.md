# Ranker Quality Fix Plan — Wellspan Forensics → Code

Scope: 7 fixes (F1–F7) derived from the forensic audit of the two Wellspan Health runs. Sequenced by risk-reduction-per-edit. Each fix lists the file, the exact change, and the verification step.

## Root cause recap (one paragraph)

The PDL `must` clause merges `job_company_*` terms with `experience.company.*` terms inside the same `should`, so PDL returns anyone who *ever* worked at the anchor company even when the parser set `current_role_only: true`. The deterministic scorer rewards those title/ONET matches, the AI reranker has no `job_company_id` or experience array in its brief so it can't tell current vs. past, and the 0.6/0.4 blend then launders the wrong-employer result to the top. Location never enters the query (parser left it null), and rerank metadata is never persisted, so we can't even tell from audit logs whether the LLM ran.

---

## F1 — Anchor-mode employer hard filter  (highest impact)

**File:** `supabase/functions/pdl-search/build-pdl-query.ts`

- Move `experience.company.id / name / website` terms out of the current-company `should`.
- When `parsed.current_role_only === true` AND `_resolved_company_ids?.length`, emit:
  ```
  must: [{ terms: { job_company_id: _resolved_company_ids } }, ...titleClause]
  ```
  Do NOT add experience.company.* anywhere in `must`. (Optional: add as `should` boost only when `current_role_only` is false.)
- Keep the existing 48-term title `should` clause unchanged.

**Verify:** rerun the Wellspan query; `pdl_query.must[0]` should be a single `terms` on `job_company_id`. Top 15 should all be current Wellspan staff.

## F2 — Anchor-mode blend weights

**File:** `supabase/functions/pdl-search/ai-rerank.ts` (line ~140, blended formula)

- Accept an `anchorMode: boolean` argument from caller.
- If anchorMode: `blended = round(0.25 * det + 0.75 * ai)`.
- Else: keep `0.6 / 0.4`.

**Verify:** unit-check that a candidate with `ai_score < 30` cannot end up in the top 5 when det=80 and anchor mode is on.

## F3 — Enrich reranker brief

**File:** `supabase/functions/pdl-search/ai-rerank.ts` → `buildBrief()`

Add to the brief:
- `job_company_id`
- `headline`, `summary` (truncate 280 chars)
- `experience.title.sub_role` from top 3 experience entries with `{company, sub_role, is_current}`
- bump `clinical_skills` slice from 4 → 8

Update `SYSTEM_PROMPT` to add:
> "If ANCHOR_COMPANY_IDS is provided, candidates whose `job_company_id` is not in that list MUST score ≤ 25 regardless of title match."

Pass `ANCHOR_COMPANY_IDS` through `buildIntentSummary`.

## F4 — Location fallback from anchor HQ

**File:** `supabase/functions/pdl-search/parse-query.ts` (post-parse normalization)

- If `_resolved_company_ids` resolved but `location.state` is null, look up the company's HQ state from the resolved company record and set `parsed.location.state` (and add to `parsed.locations`).
- Add `parsed._location_inferred_from = 'anchor_company'` for audit visibility.

**Verify:** Wellspan query should produce `location.state = "pennsylvania"` and the PDL query should include a `location_region` filter.

## F5 — Rerank memoization

**File:** `supabase/functions/pdl-search/index.ts` (around the rerank call)

- Compute `rerankKey = sha256(cache_key + intentHash)` where `intentHash` covers titles/specialties/companies/location.
- Read/write `pdl_cache` (or new `ai_rerank_cache` row) keyed by `rerankKey` with 4h TTL.
- On page 2+, skip the Claude call entirely if hit.

**Verify:** second pagination request for Wellspan should show `ai_rerank_ms < 50` in logs.

## F6 — Persist rerank audit metadata

**File:** `supabase/functions/pdl-search/index.ts` (audit log write)

Write into `search_audit_logs.meta`:
```json
{
  "ai_rerank": {
    "ran": true|false,
    "count": <n>,
    "model": "claude-haiku",
    "ms": <int>,
    "error": <string|null>,
    "score_histogram": { "0-19":n, "20-49":n, "50-69":n, "70-89":n, "90-100":n },
    "anchor_mode": true|false
  }
}
```

**Verify:** `select meta->'ai_rerank' from search_audit_logs order by created_at desc limit 5;` returns populated objects.

## F7 — Surface rerank state in UI

**File:** `src/components/search/SearchResults.tsx` (header strip)

- Read `ai_rerank` from the search response.
- If `ran === false`, render a small muted line: *"AI ranking unavailable — showing deterministic order."*
- If `ran === true` and `count < topN`, render: *"AI ranked top {count} of {topN}."*

Pure presentational; no business logic changes.

---

## Sequencing

```text
F1 ──► F4 ──► F3 ──► F2 ──► F6 ──► F5 ──► F7
(hard filter)  (loc)   (brief) (blend) (audit) (cache) (UI)
```

F1 + F4 alone fix the "Kadlec/UVA/Providence at the top" symptom for Wellspan. F2/F3 protect against future anchor searches. F6 closes the observability gap so the next regression is debuggable in one query. F5 and F7 are polish.

## Out of scope

- ONET ranker weight changes (separate investigation).
- Removing the 6-variant title fan-out (needs a recall study first).
- Reranker model swap (Haiku is performing fine when fed correct data).

## Technical details

- `_resolved_company_ids` already exists on `parsed_payload`; no new resolver needed.
- `pdl_cache.data` already stores the formatted candidate array — F5 can piggyback on the same row by adding a `rerank` JSONB column or a sibling row keyed by `rerankKey`.
- Anchor HQ lookup in F4 can reuse the same company resolver that produced `_resolved_company_ids` (it already fetches the PDL company record).

## Suggested first PR

F1 + F4 + F6 together. Smallest change that (a) fixes the symptom and (b) gives us the audit signal to prove it on the next Wellspan-class search.
