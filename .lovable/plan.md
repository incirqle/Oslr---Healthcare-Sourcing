
Goal

- Stop the reranker from timing out while still scoring all 50 candidates.

What I found

- `supabase/functions/pdl-search/ai-rerank.ts` currently uses `google/gemini-3.1-pro-preview` with a 25s timeout.
- The edge logs show the reranker feeding 50 candidates and then failing with `timeout`, so the app falls back to deterministic ranking.
- The 50-candidate fetch in `supabase/functions/pdl-search/index.ts` is already correct now; the problem is the model call itself.
- Claude is already in active use in this search stack (`parse-query.ts` and cascade planning), so switching the reranker to Claude fits the existing architecture.

Plan

1. Move the reranker off Gemini Pro
- Replace the reranker’s primary model in `supabase/functions/pdl-search/ai-rerank.ts` with Claude Haiku.
- Keep the same safe fallback behavior: if AI fails, return the deterministic ranking unchanged.

2. Make the rerank payload/output lighter
- Stop requiring a reason for every candidate, or make reasons optional.
- Ask Claude for compact JSON only: `rankings: [{ id, score }]`.
- This reduces latency and output size, and it is safe because `ai_match_reason` is not currently displayed in the frontend.

3. Reuse the existing Claude helper cleanly
- Extend `supabase/functions/pdl-search/ai-router.ts` so the reranker can pass the model, timeout, and a larger token budget if needed for 50 scored items.
- Keep parser/cascade behavior unchanged.

4. Keep the 50-wide ranking flow
- Leave the page-0 fetch/cache logic in `index.ts` as-is so all 50 candidates are still ranked before pagination.
- Only add clearer reranker logs if needed: provider, model, candidate count, and elapsed ms.

Validation

- Re-run the Vail orthopedic search.
- Confirm logs show Claude scoring all 50 instead of timing out.
- Confirm the top results are actual Vail-area orthopedists and the Indiana / hospitalist / non-ortho profiles are pushed down.

Technical details

- Files: `supabase/functions/pdl-search/ai-rerank.ts`, `supabase/functions/pdl-search/ai-router.ts` and possibly a very small `index.ts` logging touch.
- Recommended model: `claude-haiku-4-5-20251001` for this rerank path, because it is much better suited to fast structured classification than a Pro-style Gemini model.
