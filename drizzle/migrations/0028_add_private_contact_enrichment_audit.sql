CREATE TABLE public.contact_enrichment_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  linkedin_url text NOT NULL,
  candidate_name text,
  requested_kinds text[] NOT NULL DEFAULT '{}',
  employer text,
  employer_domain text,
  status text NOT NULL,
  http_status integer NOT NULL,
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.contact_enrichment_logs TO service_role;
ALTER TABLE public.contact_enrichment_logs ENABLE ROW LEVEL SECURITY;
CREATE INDEX contact_enrichment_logs_company_created_idx ON public.contact_enrichment_logs(company_id, created_at DESC);
CREATE INDEX contact_enrichment_logs_linkedin_created_idx ON public.contact_enrichment_logs(linkedin_url, created_at DESC);