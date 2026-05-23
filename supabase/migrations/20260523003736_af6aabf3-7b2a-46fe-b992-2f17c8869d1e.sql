
-- Mailboxes: per-user Nylas OAuth grants used for Campaign sending
CREATE TABLE public.user_mailboxes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  company_id uuid NOT NULL,
  provider text NOT NULL,
  email text NOT NULL,
  display_name text,
  nylas_grant_id text NOT NULL UNIQUE,
  scopes text[],
  status text NOT NULL DEFAULT 'active',
  last_error text,
  connected_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, email)
);

ALTER TABLE public.user_mailboxes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own mailboxes"
  ON public.user_mailboxes FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Company members can view company mailboxes"
  ON public.user_mailboxes FOR SELECT
  TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));

CREATE TRIGGER trg_user_mailboxes_updated
  BEFORE UPDATE ON public.user_mailboxes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Per-recipient send log for campaigns
CREATE TABLE public.campaign_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL,
  company_id uuid NOT NULL,
  recipient_email text NOT NULL,
  recipient_name text,
  candidate_id uuid,
  nylas_message_id text,
  nylas_thread_id text,
  sent_at timestamptz,
  opened_at timestamptz,
  clicked_at timestamptz,
  replied_at timestamptz,
  bounced boolean NOT NULL DEFAULT false,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_campaign_sends_campaign ON public.campaign_sends(campaign_id);
CREATE INDEX idx_campaign_sends_thread ON public.campaign_sends(nylas_thread_id);
CREATE INDEX idx_campaign_sends_message ON public.campaign_sends(nylas_message_id);

ALTER TABLE public.campaign_sends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members view campaign sends"
  ON public.campaign_sends FOR SELECT
  TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));

CREATE POLICY "Admins and recruiters insert campaign sends"
  ON public.campaign_sends FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_company_role(auth.uid(), company_id, 'admin'::app_role)
    OR public.has_company_role(auth.uid(), company_id, 'recruiter'::app_role)
  );

-- Suppression list (per company)
CREATE TABLE public.email_suppressions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  email text NOT NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, email)
);

ALTER TABLE public.email_suppressions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members view suppressions"
  ON public.email_suppressions FOR SELECT
  TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));

CREATE POLICY "Admins and recruiters manage suppressions"
  ON public.email_suppressions FOR ALL
  TO authenticated
  USING (
    public.has_company_role(auth.uid(), company_id, 'admin'::app_role)
    OR public.has_company_role(auth.uid(), company_id, 'recruiter'::app_role)
  )
  WITH CHECK (
    public.has_company_role(auth.uid(), company_id, 'admin'::app_role)
    OR public.has_company_role(auth.uid(), company_id, 'recruiter'::app_role)
  );

-- Unsubscribe tokens (public lookup by token)
CREATE TABLE public.email_unsubscribe_tokens (
  token text PRIMARY KEY,
  company_id uuid NOT NULL,
  email text NOT NULL,
  campaign_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_unsubscribe_tokens ENABLE ROW LEVEL SECURITY;
-- No public RLS policies — accessed only via service role in the unsubscribe edge function

-- Link mailbox to campaigns
ALTER TABLE public.email_campaigns
  ADD COLUMN mailbox_id uuid REFERENCES public.user_mailboxes(id) ON DELETE SET NULL;
