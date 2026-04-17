-- 1. Schema additions to existing tables
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS recruiting_roles text[],
  ADD COLUMN IF NOT EXISTS team_size text,
  ADD COLUMN IF NOT EXISTS primary_specialty text;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS role_title text,
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS target_start_date date;

-- 2. company_onboarding table (1 row per company)
CREATE TABLE IF NOT EXISTS public.company_onboarding (
  company_id uuid PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  step_team_complete boolean NOT NULL DEFAULT false,
  step_project_complete boolean NOT NULL DEFAULT false,
  step_invites_complete boolean NOT NULL DEFAULT false,
  step_connectors_complete boolean NOT NULL DEFAULT false,
  step_search_complete boolean NOT NULL DEFAULT false,
  success_banner_dismissed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.company_onboarding ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can view onboarding"
  ON public.company_onboarding FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));

CREATE POLICY "Company members can insert onboarding"
  ON public.company_onboarding FOR INSERT TO authenticated
  WITH CHECK (public.is_company_member(auth.uid(), company_id));

CREATE POLICY "Company members can update onboarding"
  ON public.company_onboarding FOR UPDATE TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));

CREATE TRIGGER update_company_onboarding_updated_at
  BEFORE UPDATE ON public.company_onboarding
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. company_invites table
CREATE TABLE IF NOT EXISTS public.company_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  email text NOT NULL,
  role public.app_role NOT NULL DEFAULT 'recruiter',
  invited_by uuid,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_company_invites_company ON public.company_invites(company_id);
CREATE INDEX IF NOT EXISTS idx_company_invites_token ON public.company_invites(token);
CREATE INDEX IF NOT EXISTS idx_company_invites_email ON public.company_invites(lower(email));

ALTER TABLE public.company_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can view invites"
  ON public.company_invites FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));

CREATE POLICY "Admins and recruiters can create invites"
  ON public.company_invites FOR INSERT TO authenticated
  WITH CHECK (
    public.has_company_role(auth.uid(), company_id, 'admin'::public.app_role)
    OR public.has_company_role(auth.uid(), company_id, 'recruiter'::public.app_role)
  );

CREATE POLICY "Admins can delete invites"
  ON public.company_invites FOR DELETE TO authenticated
  USING (public.has_company_role(auth.uid(), company_id, 'admin'::public.app_role));

-- Public read by token (so accept flow can resolve before signup)
CREATE POLICY "Anyone can read invite by token"
  ON public.company_invites FOR SELECT TO anon, authenticated
  USING (true);

-- 4. connector_interest table
CREATE TABLE IF NOT EXISTS public.connector_interest (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  connector text NOT NULL CHECK (connector IN ('greenhouse','lever','gmail','outlook')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, connector)
);

ALTER TABLE public.connector_interest ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can view connector interest"
  ON public.connector_interest FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));

CREATE POLICY "Company members can register interest"
  ON public.connector_interest FOR INSERT TO authenticated
  WITH CHECK (
    public.is_company_member(auth.uid(), company_id)
    AND user_id = auth.uid()
  );

-- 5. Backfill: create onboarding rows for every existing company.
-- Mark steps as complete based on existing data so existing users
-- aren't forced through the checklist.
INSERT INTO public.company_onboarding (
  company_id,
  step_team_complete,
  step_project_complete,
  step_invites_complete,
  step_connectors_complete,
  step_search_complete,
  success_banner_dismissed
)
SELECT
  c.id,
  (c.recruiting_roles IS NOT NULL AND array_length(c.recruiting_roles, 1) > 0),
  EXISTS (SELECT 1 FROM public.projects p WHERE p.company_id = c.id),
  EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.company_id = c.id GROUP BY ur.company_id HAVING COUNT(*) > 1),
  false,
  EXISTS (SELECT 1 FROM public.search_history sh WHERE sh.company_id = c.id),
  -- Existing companies with any project: treat as already-onboarded, dismiss banner
  EXISTS (SELECT 1 FROM public.projects p WHERE p.company_id = c.id)
FROM public.companies c
ON CONFLICT (company_id) DO NOTHING;

-- 6. Update handle_new_user trigger so newly-created companies also get
-- a fresh onboarding row.
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _company_id uuid;
  _invite_token text;
  _invite_company uuid;
  _invite_role public.app_role;
BEGIN
  -- Create profile
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );

  -- Check for invite token in user metadata
  _invite_token := NEW.raw_user_meta_data->>'invite_token';

  IF _invite_token IS NOT NULL THEN
    SELECT company_id, role
      INTO _invite_company, _invite_role
    FROM public.company_invites
    WHERE token = _invite_token AND accepted_at IS NULL
    LIMIT 1;
  END IF;

  IF _invite_company IS NOT NULL THEN
    -- Join the inviting company
    UPDATE public.profiles SET company_id = _invite_company WHERE user_id = NEW.id;
    INSERT INTO public.user_roles (user_id, company_id, role)
    VALUES (NEW.id, _invite_company, _invite_role);
    UPDATE public.company_invites SET accepted_at = now() WHERE token = _invite_token;
  ELSE
    -- Create a brand-new company for this user
    INSERT INTO public.companies (name)
    VALUES (COALESCE(split_part(NEW.email, '@', 1), 'My') || '''s Team')
    RETURNING id INTO _company_id;

    UPDATE public.profiles SET company_id = _company_id WHERE user_id = NEW.id;

    INSERT INTO public.user_roles (user_id, company_id, role)
    VALUES (NEW.id, _company_id, 'admin');

    -- Initialise onboarding row for the new company
    INSERT INTO public.company_onboarding (company_id)
    VALUES (_company_id)
    ON CONFLICT (company_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;