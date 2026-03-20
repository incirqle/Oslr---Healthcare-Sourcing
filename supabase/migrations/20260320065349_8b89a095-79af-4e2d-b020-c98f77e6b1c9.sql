CREATE TABLE public.user_sending_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL UNIQUE,
  domain text NOT NULL,
  from_name text NOT NULL,
  from_email text NOT NULL,
  resend_domain_id text,
  is_verified boolean DEFAULT false,
  dns_records jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.user_sending_domains ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own domain" ON public.user_sending_domains
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());