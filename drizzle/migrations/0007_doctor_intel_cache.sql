CREATE TABLE public.doctor_intel_cache (
  cache_key text PRIMARY KEY,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.doctor_intel_cache TO service_role;
ALTER TABLE public.doctor_intel_cache ENABLE ROW LEVEL SECURITY;