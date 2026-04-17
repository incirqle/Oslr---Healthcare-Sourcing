
The user wants two changes to the AI re-ranker:
1. Switch model from `google/gemini-3-flash-preview` to the highest Gemini (`google/gemini-3.1-pro-preview`).
2. Make sure all 50 candidates are actually ranked, not just 15.

From earlier investigation: PDL full search was returning only 15 because page size defaults to 15 in `fetchPDLForFullSearch`. The reranker sees what comes back from PDL — so we need to fetch a larger pool (50) before pagination, rerank globally, then return the requested page.

## Plan

### 1. Switch model in `ai-rerank.ts`
- Change `model: "google/gemini-3-flash-preview"` → `model: "google/gemini-3.1-pro-preview"`.
- Bump `RERANK_TIMEOUT_MS` from 12s → 25s (Pro is slower, especially with tool calls).
- Keep tool-calling structure identical.

### 2. Fetch a 50-deep pool for page 0, then rerank, then slice
In `supabase/functions/pdl-search/index.ts`:
- On page 0 (when AI rerank will run), request `size = max(requestedSize, 50)` from PDL instead of just the page size.
- Run `mapPerson` + `scoreAndRankResults` on the full 50.
- Run `rerankWithAI` on the full 50 (it already caps at `RERANK_TOP_N=50`).
- Slice the reranked array down to the requested page size before returning.
- Pass the full reranked list (or the necessary count) into the response so pagination still works — store the extra candidates in cache so subsequent page requests don't re-fetch/re-rank.

### 3. Cache the reranked pool
- After reranking, write the full ordered 50 back to the existing `pdl_cache` row (keyed by query hash) so page 1, 2, 3 reads come from cache and don't re-burn LLM tokens.
- Page > 0 requests skip the AI rerank entirely and just slice from cached order.

### 4. Logging
- Log the model name, candidate count fed in, count scored, and elapsed ms so we can verify "scored 50/50" in next run.

## Files to update
- `supabase/functions/pdl-search/ai-rerank.ts` — model swap + timeout bump + extra log line.
- `supabase/functions/pdl-search/index.ts` — fetch pool of 50 on page 0, rerank globally, slice for response, cache full ordered pool, skip rerank on page > 0.

## Validation
- Re-run "orthopedic surgeons in Vail Colorado" and confirm logs show:
  - `[ai-rerank] model=google/gemini-3.1-pro-preview`
  - `[ai-rerank] scored 50/50 in <ms>ms`
- Confirm Steadman / Vail-Summit orthopedists dominate the visible top 10.
- Confirm page 2 loads from cache without a second rerank call.

## Risk / tradeoff
- Pro is ~3-5x slower than Flash. First page latency likely jumps from ~5s to ~10-15s on cold cache. Subsequent pages stay fast (cache hit). Acceptable for the precision win the user is asking for.
