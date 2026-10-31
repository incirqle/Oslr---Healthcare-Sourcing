CREATE TABLE public.stripe_webhook_config (
  account text PRIMARY KEY,
  endpoint_id text NOT NULL,
  signing_secret text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.stripe_webhook_config TO service_role;
ALTER TABLE public.stripe_webhook_config ENABLE ROW LEVEL SECURITY;