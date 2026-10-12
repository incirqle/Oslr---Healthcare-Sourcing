CREATE TABLE public.search_meter_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL,
  query_norm text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.search_meter_events TO service_role;
ALTER TABLE public.search_meter_events ENABLE ROW LEVEL SECURITY;
CREATE INDEX search_meter_events_user_time ON public.search_meter_events (user_id, created_at DESC);