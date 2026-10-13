# Clinician search engine — where it came from and where it lives

The engine in `supabase/functions/_shared/clinician-engine/` is a fork of the
RepGPT hiring engine (`incirqle-ai/supabase/functions/search-talent`), ported
on 2026-09-14 per `OSLR-SEARCH-ENGINE-BLUEPRINT.md` and hardened through eight
probe rounds on 2026-09-15 (see `search-clinicians-probe-log.md`) and a
query-understanding pass on 2026-09-20. It is Crustdata v2 only. The previous
provider was removed in full on 2026-09-20 (migration `20260920120000_remove_pdl.sql`);
no code, table, column or dependency of it remains.

## Fork doctrine

- Every dependency lives inside the engine folder. The only outside consumer
  is the `search-people` adapter, which translates the search page's wire
  shape onto the engine and runs it in-process.
- Nothing is imported back from the reference engine. When the reference
  changes, the change is ported deliberately (and recorded here), never
  inherited.

## Reference changes ported after the fork

- 2026-10-06 (reference): preview returns the parse and criteria without a
  provider call. Ported 2026-10-12 — the Oslr preview had kept running the
  lexical search plus both recall passes, caching only the lexical rows, so
  every UI search showed 50 rows and discarded up to 100 paid recall rows.

## Oslr-only changes since the fork (not in the reference)

- Employer-entity resolution (University of Miami fanout), subspecialty
  families, population modifiers, fellowship qualifier, workplace care
  setting, employer size, regional gazetteer, remarks-guided widen ladder.
- 2026-10-12: surgeon role class composed with the specialty
  (`surgeonTitleTerms`), deterministic role-class noise filter before the
  grader (`noise-filter.ts`), first-page pool fill to `LEXICAL_POOL_CAP`,
  honest totals (`total_is_estimate`), and a criteria editor whose every
  field reaches the engine (`search-people/refine-filters.ts`).

## Not in scope (unchanged)

NPI verification, sandbox/demo snapshots, a credit ledger, agent-runner cleanup.
