
-- Drop old pdl_cache and recreate with simpler schema
DROP TABLE IF EXISTS public.pdl_cache;

CREATE TABLE public.pdl_cache (
  cache_key TEXT PRIMARY KEY,
  total INTEGER DEFAULT 0,
  data JSONB DEFAULT '[]'::jsonb,
  scroll_token TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.pdl_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on pdl_cache"
  ON public.pdl_cache
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read cache"
  ON public.pdl_cache
  FOR SELECT
  TO authenticated
  USING (true);

-- Search logging for rate limiting
CREATE TABLE IF NOT EXISTS public.oslr_searches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  query TEXT,
  filters JSONB DEFAULT '{}'::jsonb,
  result_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.oslr_searches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own searches"
  ON public.oslr_searches
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own searches"
  ON public.oslr_searches
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access on oslr_searches"
  ON public.oslr_searches
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
