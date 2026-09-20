# Fix: results vanish when clicking "Next page"

## What happens

The page counter is built from the provider's *estimated* match count (often hundreds or thousands), but the search only ever holds a much smaller pool of actual profiles (typically 50, at most 200). So the pager offers pages that have nobody behind them. Click "Next" past the real pool and the server returns an empty slice with a large total — the list component isn't rendered at all, and the "no matches" helper doesn't show either (because the total isn't zero). The screen simply goes blank.

Secondary contributors:
- Every page click re-runs the whole pipeline. If that run comes back thinner than the first (AI review rejects more people, a provider hiccup, a cache miss), a page that worked before can come back empty.
- If the request errors, the list has already been cleared, so the user is left with an empty screen plus a toast.

## The fix

1. **Paginate over the real pool, not the estimate.** The search response will report both the browsable count (how many profiles are actually available) and the estimated market size. The pager uses the browsable count; the headline still shows the estimate ("50 of ~1,013 matches").
2. **Never show an empty screen on a valid page.** If a page comes back with nothing while earlier pages had results, clamp back to the last page that has people and show a short "that's the end of the list" note instead of blanking.
3. **Keep the previous results on screen while a page loads**, and restore them if the request fails, instead of clearing first.
4. **Disable "Next" once the pool is exhausted**, driven by the server's `hasMore` flag rather than a computed page count.

## Technical notes

- `supabase/functions/_shared/clinician-engine/handler.ts`: add `browsable_total: allResults.length` alongside the existing `total` (displayTotal) in the search response; leave `hasMore` as is.
- `supabase/functions/search-people/index.ts`: pass `browsable_total` through in the results payload (fall back to `results.length` when absent).
- `src/pages/SearchPage.tsx`: track `browsableTotal` and `hasMore`; stop clearing `candidates` at the top of `runResultsFetch` for page changes (only clear on a brand-new search); on an empty non-first page, revert `page` to the previous value, keep the prior rows, and toast "You've reached the end of these results"; on error, restore the previous rows rather than leaving the list empty.
- `src/components/search/SearchResults.tsx`: compute `totalPages` from a new `browsableTotal` prop (default: `total`), and gate the Next button on a `hasMore` prop.
- No provider/query-building changes; credit behaviour and the deep-pagination cursor logic stay exactly as they are.
