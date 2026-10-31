CREATE TABLE public.workspace_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  category text NOT NULL,
  provider text NOT NULL,
  provider_name text,
  account_token text,
  status text NOT NULL DEFAULT 'connected',
  last_synced_at timestamptz,
  last_error text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, provider)
);
GRANT SELECT (id, company_id, category, provider, provider_name, status, last_synced_at, last_error, created_at) ON public.workspace_integrations TO authenticated;
GRANT ALL ON public.workspace_integrations TO service_role;
ALTER TABLE public.workspace_integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read their workspace integrations" ON public.workspace_integrations
  FOR SELECT TO authenticated USING (company_id = public.get_user_company_id(auth.uid()));