-- Per-user fit status for any PDL candidate (search result or saved)
CREATE TYPE public.candidate_fit_status AS ENUM ('unreviewed', 'good', 'maybe', 'not');

CREATE TABLE public.candidate_fit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  pdl_id text NOT NULL,
  status public.candidate_fit_status NOT NULL DEFAULT 'unreviewed',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, pdl_id)
);

CREATE INDEX idx_candidate_fit_user ON public.candidate_fit(user_id);
CREATE INDEX idx_candidate_fit_pdl ON public.candidate_fit(pdl_id);

ALTER TABLE public.candidate_fit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own fit ratings"
  ON public.candidate_fit FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own fit ratings"
  ON public.candidate_fit FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own fit ratings"
  ON public.candidate_fit FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own fit ratings"
  ON public.candidate_fit FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

CREATE TRIGGER update_candidate_fit_updated_at
  BEFORE UPDATE ON public.candidate_fit
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();