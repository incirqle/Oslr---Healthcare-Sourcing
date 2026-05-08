CREATE TABLE public.search_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  phase text NOT NULL,
  query_text text,
  parsed_filters jsonb,
  parsed_payload jsonb,
  pdl_query jsonb,
  reported_total integer,
  profiles_fetched integer,
  cache_hit boolean DEFAULT false,
  cascade_used boolean DEFAULT false,
  cascade_steps jsonb,
  winning_step text,
  guard text,
  error_message text,
  timing_ms integer,
  meta jsonb
);

CREATE INDEX idx_search_audit_logs_user_created ON public.search_audit_logs (user_id, created_at DESC);
CREATE INDEX idx_search_audit_logs_created ON public.search_audit_logs (created_at DESC);

ALTER TABLE public.search_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own audit logs"
  ON public.search_audit_logs FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Service role full access on search_audit_logs"
  ON public.search_audit_logs FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);