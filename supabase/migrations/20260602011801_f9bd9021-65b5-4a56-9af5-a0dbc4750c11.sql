
CREATE TABLE IF NOT EXISTS public.company_enrichment_cache (
  cache_key TEXT PRIMARY KEY,
  company_id INTEGER NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_company_enrichment_cache_created
  ON public.company_enrichment_cache (created_at);

GRANT SELECT ON public.company_enrichment_cache TO authenticated;
GRANT ALL ON public.company_enrichment_cache TO service_role;

ALTER TABLE public.company_enrichment_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read company enrichment cache"
  ON public.company_enrichment_cache
  FOR SELECT
  TO authenticated
  USING (true);
