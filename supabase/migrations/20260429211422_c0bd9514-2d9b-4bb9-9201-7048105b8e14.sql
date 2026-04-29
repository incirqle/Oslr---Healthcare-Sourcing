-- ============================================================================
-- Multi-step Campaigns: sequences schema + analytics view
-- ----------------------------------------------------------------------------
-- Adds new tables to support the multi-step "Campaigns" UI built in Lovable.
-- The user-facing label is "Campaigns" but internal table names use
-- `sequences` to avoid colliding with the legacy single-step `email_campaigns`
-- table during the deprecation window.
--
-- This migration is intentionally INDEPENDENT of the agent_* tables
-- (sourcing_agents, agent_sequences, agent_outreach_log, agent_leads).
-- The agent system stays untouched; this is a parallel pipeline for
-- human-driven multi-step outreach.
--
-- Multi-tenancy:  company_id everywhere, RLS via is_company_member() and
-- has_company_role(uid, company_id, app_role) (existing helpers).
-- ============================================================================

-- 1. Enums
CREATE TYPE public.sequence_status AS ENUM ('draft', 'active', 'paused', 'archived');
CREATE TYPE public.sequence_step_kind AS ENUM ('email', 'connection_request', 'linkedin_message', 'call');
CREATE TYPE public.sequence_step_thread_mode AS ENUM ('new', 'reply');
CREATE TYPE public.sequence_send_unit AS ENUM ('minutes', 'hours', 'days');
CREATE TYPE public.sequence_enrollment_status AS ENUM ('active', 'paused', 'completed', 'bounced', 'unsubscribed');
CREATE TYPE public.sequence_enrollment_response AS ENUM ('no_response', 'replied', 'interested', 'not_interested', 'out_of_office', 'wrong_person');
CREATE TYPE public.mailbox_provider AS ENUM ('resend', 'gmail', 'outlook', 'smtp');
CREATE TYPE public.activity_type AS ENUM (
  'email_sent', 'email_opened', 'email_clicked', 'replied', 'bounced',
  'call_logged', 'note', 'meeting',
  'enrolled_in_sequence', 'removed_from_sequence',
  'tag_added', 'tag_removed', 'status_changed'
);

-- 2. Mailboxes
CREATE TABLE public.mailboxes (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id              uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id                 uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  provider                public.mailbox_provider NOT NULL,
  email                   text NOT NULL,
  display_name            text NOT NULL,
  daily_send_cap          int  NOT NULL DEFAULT 100,
  current_day_sends       int  NOT NULL DEFAULT 0,
  current_day_started_at  date NOT NULL DEFAULT CURRENT_DATE,
  oauth_refresh_token     text,
  oauth_access_token      text,
  oauth_expires_at        timestamptz,
  is_primary              boolean NOT NULL DEFAULT false,
  is_active               boolean NOT NULL DEFAULT true,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, email)
);
CREATE INDEX idx_mailboxes_company ON public.mailboxes (company_id);
CREATE INDEX idx_mailboxes_user    ON public.mailboxes (user_id) WHERE user_id IS NOT NULL;
ALTER TABLE public.mailboxes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Company members can view mailboxes" ON public.mailboxes
  FOR SELECT TO authenticated USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "Admins and recruiters can create mailboxes" ON public.mailboxes
  FOR INSERT TO authenticated WITH CHECK (
    public.has_company_role(auth.uid(), company_id, 'admin'::public.app_role)
    OR public.has_company_role(auth.uid(), company_id, 'recruiter'::public.app_role)
  );
CREATE POLICY "Admins and recruiters can update mailboxes" ON public.mailboxes
  FOR UPDATE TO authenticated USING (
    public.has_company_role(auth.uid(), company_id, 'admin'::public.app_role)
    OR public.has_company_role(auth.uid(), company_id, 'recruiter'::public.app_role)
  );
CREATE POLICY "Admins can delete mailboxes" ON public.mailboxes
  FOR DELETE TO authenticated USING (public.has_company_role(auth.uid(), company_id, 'admin'::public.app_role));

-- 3. Sequences (the new multi-step Campaigns)
CREATE TABLE public.sequences (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id              uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name                    text NOT NULL,
  owner_id                uuid NOT NULL REFERENCES auth.users(id),
  status                  public.sequence_status NOT NULL DEFAULT 'draft',
  use_multiple_senders    boolean NOT NULL DEFAULT false,
  new_thread_per_sender   boolean NOT NULL DEFAULT false,
  archived_at             timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_sequences_company_status  ON public.sequences (company_id, status) WHERE archived_at IS NULL;
CREATE INDEX idx_sequences_company_created ON public.sequences (company_id, created_at DESC);
CREATE INDEX idx_sequences_owner           ON public.sequences (owner_id);
ALTER TABLE public.sequences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Company members can view sequences" ON public.sequences
  FOR SELECT TO authenticated USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "Admins and recruiters can create sequences" ON public.sequences
  FOR INSERT TO authenticated WITH CHECK (
    public.has_company_role(auth.uid(), company_id, 'admin'::public.app_role)
    OR public.has_company_role(auth.uid(), company_id, 'recruiter'::public.app_role)
  );
CREATE POLICY "Admins and recruiters can update sequences" ON public.sequences
  FOR UPDATE TO authenticated USING (
    public.has_company_role(auth.uid(), company_id, 'admin'::public.app_role)
    OR public.has_company_role(auth.uid(), company_id, 'recruiter'::public.app_role)
  );
CREATE POLICY "Admins and recruiters can delete sequences" ON public.sequences
  FOR DELETE TO authenticated USING (
    public.has_company_role(auth.uid(), company_id, 'admin'::public.app_role)
    OR public.has_company_role(auth.uid(), company_id, 'recruiter'::public.app_role)
  );

-- 4. Sequence steps
CREATE TABLE public.sequence_steps (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id         uuid NOT NULL REFERENCES public.sequences(id) ON DELETE CASCADE,
  step_index          int  NOT NULL,
  kind                public.sequence_step_kind NOT NULL,
  thread_mode         public.sequence_step_thread_mode NOT NULL DEFAULT 'new',
  from_mailbox_id     uuid REFERENCES public.mailboxes(id),
  subject             text,
  body_html           text NOT NULL DEFAULT '',
  send_after_value    int  NOT NULL DEFAULT 0,
  send_after_unit     public.sequence_send_unit NOT NULL DEFAULT 'days',
  business_hours_only boolean NOT NULL DEFAULT true,
  timezone            text NOT NULL DEFAULT 'America/Denver',
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sequence_id, step_index)
);
CREATE INDEX idx_sequence_steps_sequence ON public.sequence_steps (sequence_id, step_index);
ALTER TABLE public.sequence_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Company members can view sequence steps" ON public.sequence_steps
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.sequences s WHERE s.id = sequence_id AND public.is_company_member(auth.uid(), s.company_id)
  ));
CREATE POLICY "Admins and recruiters can write sequence steps" ON public.sequence_steps
  FOR ALL TO authenticated USING (EXISTS (
    SELECT 1 FROM public.sequences s WHERE s.id = sequence_id
      AND (public.has_company_role(auth.uid(), s.company_id, 'admin'::public.app_role)
        OR public.has_company_role(auth.uid(), s.company_id, 'recruiter'::public.app_role))
  )) WITH CHECK (EXISTS (
    SELECT 1 FROM public.sequences s WHERE s.id = sequence_id
      AND (public.has_company_role(auth.uid(), s.company_id, 'admin'::public.app_role)
        OR public.has_company_role(auth.uid(), s.company_id, 'recruiter'::public.app_role))
  ));

-- 5. Sequence enrollments
CREATE TABLE public.sequence_enrollments (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id          uuid NOT NULL REFERENCES public.sequences(id) ON DELETE CASCADE,
  candidate_id         uuid NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  status               public.sequence_enrollment_status NOT NULL DEFAULT 'active',
  current_step_index   int  NOT NULL DEFAULT 1,
  response             public.sequence_enrollment_response NOT NULL DEFAULT 'no_response',
  added_by             uuid NOT NULL REFERENCES auth.users(id),
  added_at             timestamptz NOT NULL DEFAULT now(),
  paused_at            timestamptz,
  completed_at         timestamptz,
  bounced_at           timestamptz,
  unsubscribed_at      timestamptz,
  UNIQUE (sequence_id, candidate_id)
);
CREATE INDEX idx_sequence_enrollments_sequence_status ON public.sequence_enrollments (sequence_id, status);
CREATE INDEX idx_sequence_enrollments_candidate       ON public.sequence_enrollments (candidate_id);
CREATE INDEX idx_sequence_enrollments_response        ON public.sequence_enrollments (sequence_id, response) WHERE response <> 'no_response';
ALTER TABLE public.sequence_enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Company members can view enrollments" ON public.sequence_enrollments
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.sequences s WHERE s.id = sequence_id AND public.is_company_member(auth.uid(), s.company_id)
  ));
CREATE POLICY "Admins and recruiters can write enrollments" ON public.sequence_enrollments
  FOR ALL TO authenticated USING (EXISTS (
    SELECT 1 FROM public.sequences s WHERE s.id = sequence_id
      AND (public.has_company_role(auth.uid(), s.company_id, 'admin'::public.app_role)
        OR public.has_company_role(auth.uid(), s.company_id, 'recruiter'::public.app_role))
  )) WITH CHECK (EXISTS (
    SELECT 1 FROM public.sequences s WHERE s.id = sequence_id
      AND (public.has_company_role(auth.uid(), s.company_id, 'admin'::public.app_role)
        OR public.has_company_role(auth.uid(), s.company_id, 'recruiter'::public.app_role))
  ));

-- 6. Sequence step events (service-role written via edge functions)
CREATE TABLE public.sequence_step_events (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id       uuid NOT NULL REFERENCES public.sequence_enrollments(id) ON DELETE CASCADE,
  step_id             uuid NOT NULL REFERENCES public.sequence_steps(id) ON DELETE CASCADE,
  mailbox_id          uuid REFERENCES public.mailboxes(id),
  scheduled_for       timestamptz NOT NULL,
  sent_at             timestamptz,
  resend_message_id   text,
  thread_id           text,
  opened_at           timestamptz,
  open_count          int  NOT NULL DEFAULT 0,
  first_clicked_at    timestamptz,
  click_count         int  NOT NULL DEFAULT 0,
  replied_at          timestamptz,
  bounced_at          timestamptz,
  bounce_type         text,
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_sse_enrollment        ON public.sequence_step_events (enrollment_id);
CREATE INDEX idx_sse_mailbox_sent      ON public.sequence_step_events (mailbox_id, sent_at);
CREATE INDEX idx_sse_resend_message_id ON public.sequence_step_events (resend_message_id) WHERE resend_message_id IS NOT NULL;
CREATE INDEX idx_sse_due               ON public.sequence_step_events (scheduled_for) WHERE sent_at IS NULL;
ALTER TABLE public.sequence_step_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Company members can view step events" ON public.sequence_step_events
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.sequence_enrollments enr
    JOIN public.sequences s ON s.id = enr.sequence_id
    WHERE enr.id = enrollment_id AND public.is_company_member(auth.uid(), s.company_id)
  ));

-- 7. Snippets
CREATE TABLE public.snippets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name        text NOT NULL,
  body_html   text NOT NULL DEFAULT '',
  created_by  uuid NOT NULL REFERENCES auth.users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, name)
);
CREATE INDEX idx_snippets_company ON public.snippets (company_id);
ALTER TABLE public.snippets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Company members can view snippets" ON public.snippets
  FOR SELECT TO authenticated USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "Admins and recruiters can write snippets" ON public.snippets
  FOR ALL TO authenticated USING (
    public.has_company_role(auth.uid(), company_id, 'admin'::public.app_role)
    OR public.has_company_role(auth.uid(), company_id, 'recruiter'::public.app_role)
  ) WITH CHECK (
    public.has_company_role(auth.uid(), company_id, 'admin'::public.app_role)
    OR public.has_company_role(auth.uid(), company_id, 'recruiter'::public.app_role)
  );

-- 8. Tags M-N on candidates (additive — leaves existing candidates.tags text[] alone)
CREATE TABLE public.tags (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name        text NOT NULL,
  color       text NOT NULL DEFAULT 'gray',
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, name)
);
CREATE TABLE public.candidate_tag (
  candidate_id  uuid NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  tag_id        uuid NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  added_at      timestamptz NOT NULL DEFAULT now(),
  added_by      uuid NOT NULL REFERENCES auth.users(id),
  PRIMARY KEY (candidate_id, tag_id)
);
CREATE INDEX idx_candidate_tag_tag ON public.candidate_tag (tag_id);
ALTER TABLE public.tags          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_tag ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Company members can view tags" ON public.tags
  FOR SELECT TO authenticated USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "Admins and recruiters can write tags" ON public.tags
  FOR ALL TO authenticated USING (
    public.has_company_role(auth.uid(), company_id, 'admin'::public.app_role)
    OR public.has_company_role(auth.uid(), company_id, 'recruiter'::public.app_role)
  ) WITH CHECK (
    public.has_company_role(auth.uid(), company_id, 'admin'::public.app_role)
    OR public.has_company_role(auth.uid(), company_id, 'recruiter'::public.app_role)
  );
CREATE POLICY "Company members can view candidate-tag links" ON public.candidate_tag
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.tags t WHERE t.id = tag_id AND public.is_company_member(auth.uid(), t.company_id)
  ));
CREATE POLICY "Admins and recruiters can write candidate-tag links" ON public.candidate_tag
  FOR ALL TO authenticated USING (EXISTS (
    SELECT 1 FROM public.tags t WHERE t.id = tag_id
      AND (public.has_company_role(auth.uid(), t.company_id, 'admin'::public.app_role)
        OR public.has_company_role(auth.uid(), t.company_id, 'recruiter'::public.app_role))
  )) WITH CHECK (EXISTS (
    SELECT 1 FROM public.tags t WHERE t.id = tag_id
      AND (public.has_company_role(auth.uid(), t.company_id, 'admin'::public.app_role)
        OR public.has_company_role(auth.uid(), t.company_id, 'recruiter'::public.app_role))
  ));

-- 9. Activity log (Notes tab + analytics)
CREATE TABLE public.activity_log (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  candidate_id uuid REFERENCES public.candidates(id) ON DELETE CASCADE,
  type         public.activity_type NOT NULL,
  payload      jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at  timestamptz NOT NULL DEFAULT now(),
  actor_id     uuid REFERENCES auth.users(id)
);
CREATE INDEX idx_activity_log_company_occurred ON public.activity_log (company_id, occurred_at DESC);
CREATE INDEX idx_activity_log_candidate        ON public.activity_log (candidate_id, occurred_at DESC) WHERE candidate_id IS NOT NULL;
CREATE INDEX idx_activity_log_type             ON public.activity_log (company_id, type, occurred_at DESC);
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Company members can view activity log" ON public.activity_log
  FOR SELECT TO authenticated USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "Company members can insert activity log" ON public.activity_log
  FOR INSERT TO authenticated WITH CHECK (public.is_company_member(auth.uid(), company_id));

-- 10. Materialized view for analytics rollups
CREATE MATERIALIZED VIEW public.mv_sequence_stats AS
SELECT
  s.id                                                            AS sequence_id,
  s.company_id                                                    AS company_id,
  date_trunc('day', e.sent_at)                                    AS day,
  COUNT(DISTINCT e.id)                                            AS sends,
  COUNT(DISTINCT e.id) FILTER (WHERE e.opened_at IS NOT NULL)     AS opens_distinct,
  SUM(e.open_count)                                               AS opens_total,
  COUNT(DISTINCT e.id) FILTER (WHERE e.first_clicked_at IS NOT NULL) AS clicks_distinct,
  SUM(e.click_count)                                              AS clicks_total,
  COUNT(DISTINCT e.id) FILTER (WHERE e.replied_at IS NOT NULL)    AS replies,
  COUNT(DISTINCT e.id) FILTER (WHERE e.bounced_at IS NOT NULL)    AS bounces,
  COUNT(DISTINCT enr.id) FILTER (WHERE enr.response = 'interested') AS interested
FROM public.sequences s
JOIN public.sequence_enrollments enr ON enr.sequence_id = s.id
JOIN public.sequence_step_events e   ON e.enrollment_id = enr.id
WHERE e.sent_at IS NOT NULL
GROUP BY s.id, s.company_id, date_trunc('day', e.sent_at);

CREATE UNIQUE INDEX idx_mv_sequence_stats_pk ON public.mv_sequence_stats (sequence_id, day);
CREATE INDEX idx_mv_sequence_stats_company   ON public.mv_sequence_stats (company_id, day DESC);

CREATE OR REPLACE FUNCTION public.refresh_mv_sequence_stats()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_sequence_stats;
END;
$$;

GRANT EXECUTE ON FUNCTION public.refresh_mv_sequence_stats() TO authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'refresh_mv_sequence_stats_every_15min',
      '*/15 * * * *',
      'SELECT public.refresh_mv_sequence_stats();'
    );
  END IF;
END $$;

-- 11. updated_at triggers (use existing helper)
CREATE TRIGGER trg_sequences_updated_at
  BEFORE UPDATE ON public.sequences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_sequence_steps_updated_at
  BEFORE UPDATE ON public.sequence_steps
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_mailboxes_updated_at
  BEFORE UPDATE ON public.mailboxes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_snippets_updated_at
  BEFORE UPDATE ON public.snippets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- DONE.
-- Follow-up PRs (NOT in this migration):
--   - Backfill: copy public.email_campaigns -> public.sequences (1-step each)
--     and public.email_events -> public.sequence_step_events.
--   - Deprecate: drop public.email_campaigns, email_events, email_templates
--     after a 30-day soak.
