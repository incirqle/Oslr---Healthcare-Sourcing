CREATE TABLE public.agent_sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  name text NOT NULL,
  steps jsonb NOT NULL,
  from_name text,
  reply_to_email text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.agent_sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own sequences" ON public.agent_sequences
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());