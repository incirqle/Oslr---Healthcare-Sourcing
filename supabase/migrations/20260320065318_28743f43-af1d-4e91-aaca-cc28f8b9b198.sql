CREATE TABLE public.agent_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid REFERENCES public.sourcing_agents(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users NOT NULL,
  pdl_person_id text NOT NULL,
  profile_snapshot jsonb NOT NULL,
  match_score numeric(4,3),
  match_label text CHECK (match_label IN ('strong_match','good_match','potential_fit','not_a_match')),
  match_reasoning text,
  ai_summary text,
  status text CHECK (status IN ('pending','approved','rejected','contacted','shortlisted','hidden')) DEFAULT 'pending',
  reviewer_feedback text,
  sequence_step integer DEFAULT 0,
  last_contacted_at timestamptz,
  email_opens integer DEFAULT 0,
  email_replies integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_agent_leads_agent_status ON public.agent_leads (agent_id, status);
CREATE INDEX idx_agent_leads_agent_created ON public.agent_leads (agent_id, created_at DESC);

ALTER TABLE public.agent_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own leads" ON public.agent_leads
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());