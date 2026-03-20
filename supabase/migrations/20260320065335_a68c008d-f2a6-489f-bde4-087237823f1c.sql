CREATE TABLE public.agent_outreach_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid REFERENCES public.sourcing_agents(id),
  lead_id uuid REFERENCES public.agent_leads(id),
  user_id uuid REFERENCES auth.users NOT NULL,
  step integer NOT NULL,
  to_email text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  sent_at timestamptz DEFAULT now(),
  opened_at timestamptz,
  replied_at timestamptz,
  bounced boolean DEFAULT false,
  email_provider text,
  message_id text,
  resend_email_id text,
  resend_batch_id text,
  from_email text,
  from_name text
);

ALTER TABLE public.agent_outreach_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own outreach" ON public.agent_outreach_log
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());