

# Surgical Rewrite: `pdl-search` Edge Function

This plan implements the uploaded spec — replacing the current broken SQL-based PDL search with a proven Elasticsearch DSL architecture adapted from RepGPT.

---

## What Changes

The entire `supabase/functions/pdl-search/` directory gets rewritten with 8 files. The frontend `SearchPage.tsx` gets updated to match the new API contract (single endpoint, `preview` flag, different response shape). A new `oslr_searches` table is created for rate limiting, and the existing `pdl_cache` table is replaced with the simpler schema the new code expects. An `ANTHROPIC_API_KEY` secret is required.

---

## Step 1: Database Migration

Create `oslr_searches` table and update `pdl_cache` to match the new schema:

```sql
-- New cache table (replaces old pdl_cache)
DROP TABLE IF EXISTS pdl_cache;
CREATE TABLE pdl_cache (
  cache_key TEXT PRIMARY KEY,
  total INTEGER DEFAULT 0,
  data JSONB DEFAULT '[]',
  scroll_token TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Search logging for rate limiting
CREATE TABLE IF NOT EXISTS oslr_searches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  query TEXT,
  filters JSONB DEFAULT '{}',
  result_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

RLS: `oslr_searches` needs insert policy for authenticated users and select for own rows.

---

## Step 2: Add `ANTHROPIC_API_KEY` Secret

The new architecture uses Claude Haiku as the primary AI parser. Will prompt user to add their Anthropic API key.

Note: The existing secret is named `PDL_PREVIEW_KEY` but the spec references `PDL_PREVIEW_API_KEY`. The code will use whichever name is configured.

---

## Step 3: Rewrite Edge Function Files (8 files)

All under `supabase/functions/pdl-search/`:

| File | Description |
|------|-------------|
| `ai-router.ts` | Direct Anthropic API helper for Claude Haiku/Sonnet |
| `cache.ts` | Simplified SHA-256 cache key generation |
| `fetch-pdl-results.ts` | Two-key routing, retry with backoff, DB cache, advisory locks |
| `config.ts` | Clinical keyword expansions, health system divisions, metro maps, title expansions |
| `parse-query.ts` | Claude L2 parser with confidence scores, Gemini fallback, deterministic last resort |
| `build-pdl-query.ts` | Elasticsearch DSL builder with cascade support |
| `format-results.ts` | PDL record → FormattedCandidate mapping |
| `index.ts` | Orchestrator: auth → parse → build → preview/fetch → cascade → respond |

Key architectural changes:
- **SQL → Elasticsearch DSL**: PDL queries use `bool` with `filter/must/should/must_not`
- **Two-key routing**: Preview key for counts (0 credits), live key for profiles
- **Cascade planner**: Claude L5 decides filter relaxation when results are sparse
- **Advisory locks**: Prevents thundering herd on identical queries
- **JWT auth + role checks**: Validates user has admin/recruiter role
- **Retry logic**: Exponential backoff on 429 (rate limit) responses

Note: `CITY_TO_METRO` and `NEARBY_CITIES` maps are stubbed in the spec with "copy from RepGPT" comments. Will populate with the major city entries shown plus reasonable defaults.

---

## Step 4: Update Frontend (`SearchPage.tsx`)

The new API has a different contract:
- Single endpoint with `preview: true/false` flag (replaces `action: "parse_filters"` / `action: "search_with_filters"`)
- Response shape: `{ results, total, parsed, parsed_categories, parsed_keywords, scroll_token, hasMore }`
- No separate `parse_filters` step — preview mode returns `{ preview: true, total, parsed }`

Changes needed in `SearchPage.tsx`:
- `handleInitialSearch`: Call with `{ query, preview: true }` → get back parsed filters + total count
- `handleRunSearch`: Call with `{ query, filters, page, size }` → get back results
- Map `FormattedCandidate` fields to the existing `Candidate` interface

Also update `FilterReview.tsx` and `FilterEditor.tsx` to work with the new parsed payload shape (confidence scores, `location` object vs flat `locations` array).

---

## Step 5: Deploy and Test

Deploy the edge function and run a test query to verify end-to-end.

---

## Technical Notes

- The spec references `ANTHROPIC_API_KEY` for Claude calls. If this is not available, the system falls back to Gemini via Lovable AI Gateway, then to deterministic parsing.
- The `pdl_cache` table schema change is breaking — existing cached data will be lost (acceptable since the query format changed entirely).
- The `user_roles` table already exists with `admin` and `recruiter` roles, which the new auth check uses.
- Secret `PDL_PREVIEW_KEY` (current name) will be read as `PDL_PREVIEW_API_KEY` in code — will adapt the code to check both names.

