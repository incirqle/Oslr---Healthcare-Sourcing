CREATE TABLE IF NOT EXISTS public.company_entity_cache (
  canonical_name TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

GRANT SELECT, INSERT, UPDATE ON public.company_entity_cache TO service_role;

ALTER TABLE public.company_entity_cache ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS by default; no policies needed for client roles.
-- This table is written/read only from the edge function via service role.

CREATE OR REPLACE FUNCTION public.update_company_entity_cache_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_company_entity_cache_updated_at
BEFORE UPDATE ON public.company_entity_cache
FOR EACH ROW EXECUTE FUNCTION public.update_company_entity_cache_updated_at();