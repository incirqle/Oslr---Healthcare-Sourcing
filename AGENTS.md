# AGENTS.md

- Per-criterion results and the match rate are computed server-side in `supabase/functions/_shared/clinician-engine/ranking-criteria.ts` (rules first, the grader only for what rules leave); the browser only joins criterion titles and renders. Why: one scoring source shared by tests, cards and the later table view.
- Live re-ranking in the browser (reorder, must-have, remove) goes through `src/lib/ranking.ts`, a straight port of the server's `scoreRow`; it only re-weights per-criterion results the server returned. Why: instant changes with no request, one formula on both sides.
