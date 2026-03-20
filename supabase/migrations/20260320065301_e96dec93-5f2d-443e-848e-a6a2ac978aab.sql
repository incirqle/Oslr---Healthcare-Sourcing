CREATE TABLE public.sourcing_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  name text NOT NULL,
  status text CHECK (status IN ('configuring','active','paused','out_of_leads','stopped','failed')) DEFAULT 'configuring',
  role_description text NOT NULL,
  parsed_payload jsonb,
  pdl_query jsonb,
  calibration_approved integer DEFAULT 0,
  calibration_locked boolean DEFAULT false,
  calibration_notes text[],
  criteria_pinned text[],
  sequence_mode text CHECK (sequence_mode IN ('shortlist','auto_sequence')) DEFAULT 'shortlist',
  sequence_id uuid REFERENCES public.agent_sequences(id),
  review_mode text CHECK (review_mode IN ('manual','auto')) DEFAULT 'manual',
  daily_lead_quota integer DEFAULT 5,
  leads_total integer DEFAULT 0,
  leads_contacted integer DEFAULT 0,
  last_run_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.sourcing_agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own agents" ON public.sourcing_agents
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());