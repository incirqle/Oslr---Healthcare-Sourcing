
CREATE TABLE public.pdl_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  query_hash text NOT NULL UNIQUE,
  query_text text,
  filters jsonb,
  response jsonb NOT NULL,
  total_count integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '4 hours')
);

CREATE TABLE public.people_enrichments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pdl_id text UNIQUE,
  linkedin_url text,
  enriched_data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pdl_cache_hash ON public.pdl_cache(query_hash);
CREATE INDEX idx_pdl_cache_expires ON public.pdl_cache(expires_at);
CREATE INDEX idx_people_enrichments_linkedin ON public.people_enrichments(linkedin_url);

ALTER TABLE public.pdl_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.people_enrichments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read cache" ON public.pdl_cache
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read enrichments" ON public.people_enrichments
  FOR SELECT TO authenticated USING (true);
