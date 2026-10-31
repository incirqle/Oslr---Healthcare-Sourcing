ALTER TABLE public.company_features ADD COLUMN IF NOT EXISTS billing_hold text;
ALTER TABLE public.company_features ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean NOT NULL DEFAULT false;
ALTER TABLE public.company_features ADD COLUMN IF NOT EXISTS canceled_at timestamptz;

CREATE TABLE public.billing_events (
  stripe_event_id text PRIMARY KEY,
  account text NOT NULL,
  type text NOT NULL,
  company_id uuid,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.billing_events TO service_role;
ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.billing_nudges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid,
  email text NOT NULL,
  kind text NOT NULL,
  dedupe_key text NOT NULL UNIQUE,
  send_after timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  canceled_at timestamptz,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.billing_nudges TO service_role;
ALTER TABLE public.billing_nudges ENABLE ROW LEVEL SECURITY;
CREATE INDEX billing_nudges_due ON public.billing_nudges (send_after) WHERE sent_at IS NULL AND canceled_at IS NULL;