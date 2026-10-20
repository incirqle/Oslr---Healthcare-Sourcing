# AGENTS.md

- Unlimited contact passes are authorized only by `billing_exemptions.unlimited_access` read server-side after resolving the caller's workspace; ordinary billing exemptions remain credit-metered. Why: permanent free lookup access must not rely on client flags, admin roles, or a finite credit grant.

- Per-criterion results and the match rate are computed server-side in `supabase/functions/_shared/clinician-engine/ranking-criteria.ts` (rules first, the grader only for what rules leave); the browser only joins criterion titles and renders. Why: one scoring source shared by tests, cards and the later table view.
- Live re-ranking in the browser (reorder, must-have, remove) goes through `src/lib/ranking.ts`, a straight port of the server's `scoreRow`; it only re-weights per-criterion results the server returned. Why: instant changes with no request, one formula on both sides.
- Checking added or edited criteria (`rank_criteria`) and explanations (`explain_criteria`) live in `_shared/clinician-engine/rank-actions.ts` (pure, injected deps) and `rank-route.ts` (cache + grader wiring); they read only the run snapshot cached under `clin:run:<run_id>` and must never import the people-data provider. Why: zero provider credits, enforced by rank-actions.test.ts.
