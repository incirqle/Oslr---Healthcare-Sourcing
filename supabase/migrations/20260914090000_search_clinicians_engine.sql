-- search-clinicians engine tables (fork doctrine: this engine's own cache,
-- history, and run-intelligence tables — nothing shared with the legacy search function).

-- Crustdata v2 search + enrichment cache. Keys are versioned criteria hashes
-- ("clin:" prefix) written only by the service role from the edge function.
CREATE TABLE IF NOT EXISTS public.crustdata_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key text NOT NULL UNIQUE,
  total integer NOT NULL DEFAULT 0,
  data jsonb NOT NULL DEFAULT '[]'::jsonb,
  next_cursor text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_crustdata_cache_key ON public.crustdata_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_crustdata_cache_created ON public.crustdata_cache(created_at);

-- Recent-searches history for the clinician engine.
CREATE TABLE IF NOT EXISTS public.clinician_searches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  query text NOT NULL,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  result_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_clinician_searches_user ON public.clinician_searches(user_id, created_at DESC);

-- Per-run intelligence: raw query, parsed payload, criteria, THE REAL filter
-- tree, counts, cache hit, credits, audit summary, latency, recall flags.
CREATE TABLE IF NOT EXISTS public.clinician_search_intelligence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id text NOT NULL,
  engine text NOT NULL DEFAULT 'clinician',
  engine_version text,
  user_id uuid,
  raw_query text,
  parsed_payload jsonb,
  criteria jsonb,
  provider_query jsonb,
  result_count integer,
  total_count integer,
  page integer,
  size integer,
  widened boolean,
  widen_options jsonb,
  cache_hit boolean,
  credits_charged numeric,
  credits_session numeric,
  credit_ceiling numeric,
  audit_summary jsonb,
  latency_ms integer,
  error_code text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_clinician_intel_run ON public.clinician_search_intelligence(run_id);
CREATE INDEX IF NOT EXISTS idx_clinician_intel_user ON public.clinician_search_intelligence(user_id, created_at DESC);

-- RLS: service-role-only writes for cache and intelligence; users may read
-- their own search history.
ALTER TABLE public.crustdata_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinician_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinician_search_intelligence ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "clinician_searches_select_own"
    ON public.clinician_searches FOR SELECT
    USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
