-- 1. Lock workspace membership: only server functions (signup, invite acceptance) may set company_id.
CREATE OR REPLACE FUNCTION public.protect_profile_company() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF current_user IN ('authenticated','anon') THEN
    IF TG_OP = 'INSERT' AND NEW.company_id IS NOT NULL THEN RAISE EXCEPTION 'Workspace membership can only be set by an invitation'; END IF;
    IF TG_OP = 'UPDATE' AND NEW.company_id IS DISTINCT FROM OLD.company_id THEN RAISE EXCEPTION 'Workspace membership can only be changed by an invitation'; END IF;
    IF TG_OP = 'UPDATE' AND NEW.user_id IS DISTINCT FROM OLD.user_id THEN RAISE EXCEPTION 'Not allowed'; END IF;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS protect_profile_company ON public.profiles;
CREATE TRIGGER protect_profile_company BEFORE INSERT OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.protect_profile_company();

-- 2. Workspace lookup only for yourself, your own teammates, or the server.
CREATE OR REPLACE FUNCTION public.get_user_company_id(_user_id uuid) RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT p.company_id FROM public.profiles p
  WHERE p.user_id = _user_id
    AND (auth.uid() IS NULL OR _user_id = auth.uid()
         OR p.company_id = (SELECT me.company_id FROM public.profiles me WHERE me.user_id = auth.uid()))
  LIMIT 1;
$$;
REVOKE EXECUTE ON FUNCTION public.get_user_company_id(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_user_company_id(uuid) TO authenticated, service_role;

-- 3. Permanent trial search counter (deleting history no longer gives searches back).
ALTER TABLE public.beta_access ADD COLUMN IF NOT EXISTS searches_used integer NOT NULL DEFAULT 0;
UPDATE public.beta_access b SET searches_used = (SELECT count(*) FROM public.search_history h WHERE h.company_id=b.company_id AND h.created_at>=b.activated_at);
CREATE OR REPLACE FUNCTION public.count_trial_search() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  UPDATE public.beta_access SET searches_used = searches_used + 1 WHERE company_id = NEW.company_id AND now() >= activated_at;
  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.count_trial_search() FROM anon, authenticated, public;
DROP TRIGGER IF EXISTS count_trial_search ON public.search_history;
CREATE TRIGGER count_trial_search AFTER INSERT ON public.search_history FOR EACH ROW EXECUTE FUNCTION public.count_trial_search();

CREATE OR REPLACE FUNCTION public.beta_status()
 RETURNS TABLE(active boolean, expires_at timestamp with time zone, searches_used integer, search_limit integer, enriches_used integer, enrich_limit integer)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT (now() < b.expires_at AND b.searches_used < b.search_limit AND e.n < b.enrich_limit),
    b.expires_at, b.searches_used, b.search_limit, e.n, b.enrich_limit
  FROM public.beta_access b
  CROSS JOIN LATERAL (SELECT count(DISTINCT t.linkedin_url)::int n FROM public.credit_transactions t WHERE t.company_id = b.company_id AND t.credits < 0 AND t.created_at >= b.activated_at) e
  WHERE b.company_id = public.get_user_company_id(auth.uid());
$$;

-- 4. Optional monthly credit limit set on the invitation itself.
ALTER TABLE public.company_invites ADD COLUMN IF NOT EXISTS monthly_limit integer CHECK (monthly_limit IS NULL OR monthly_limit >= 0);

CREATE OR REPLACE FUNCTION public.apply_invite_limit(_company uuid, _user uuid, _limit integer) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
  INSERT INTO public.member_credit_limits(company_id,user_id,monthly_limit) SELECT _company,_user,_limit WHERE _limit IS NOT NULL
  ON CONFLICT (company_id,user_id) DO UPDATE SET monthly_limit=EXCLUDED.monthly_limit, updated_at=now();
$$;
REVOKE EXECUTE ON FUNCTION public.apply_invite_limit(uuid,uuid,integer) FROM anon, authenticated, public;

CREATE OR REPLACE FUNCTION public.accept_workspace_invite(_token text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$ DECLARE inv public.company_invites; current_company uuid; BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Please sign in'; END IF;
 SELECT * INTO inv FROM public.company_invites WHERE token=_token FOR UPDATE;
 IF NOT FOUND OR lower(inv.email) IS DISTINCT FROM lower(auth.jwt()->>'email') THEN RAISE EXCEPTION 'This invitation belongs to a different email address'; END IF;
 SELECT company_id INTO current_company FROM public.profiles WHERE user_id=auth.uid();
 IF current_company=inv.company_id THEN RETURN inv.company_id; END IF;
 IF inv.accepted_at IS NOT NULL THEN RAISE EXCEPTION 'Invitation already accepted'; END IF;
 IF EXISTS(SELECT 1 FROM public.projects WHERE company_id=current_company) OR EXISTS(SELECT 1 FROM public.credit_transactions WHERE company_id=current_company AND credits<0) OR EXISTS(SELECT 1 FROM public.profiles WHERE company_id=current_company AND user_id<>auth.uid()) THEN RAISE EXCEPTION 'Your account already belongs to an active workspace. Contact your admin before switching teams.'; END IF;
 UPDATE public.profiles SET company_id=inv.company_id WHERE user_id=auth.uid();
 DELETE FROM public.user_roles WHERE user_id=auth.uid() AND company_id=current_company;
 INSERT INTO public.user_roles(user_id,company_id,role) VALUES(auth.uid(),inv.company_id,inv.role);
 PERFORM public.apply_invite_limit(inv.company_id, auth.uid(), inv.monthly_limit);
 UPDATE public.company_invites SET accepted_at=now() WHERE id=inv.id;
 RETURN inv.company_id; END; $function$;

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE _company_id uuid; _invite_token text; _inv public.company_invites;
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name) VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  _invite_token := NEW.raw_user_meta_data->>'invite_token';
  IF _invite_token IS NOT NULL THEN
    SELECT * INTO _inv FROM public.company_invites
    WHERE token = _invite_token AND accepted_at IS NULL AND lower(email) = lower(NEW.email) LIMIT 1;
  END IF;
  IF _inv.id IS NOT NULL THEN
    UPDATE public.profiles SET company_id = _inv.company_id WHERE user_id = NEW.id;
    INSERT INTO public.user_roles (user_id, company_id, role) VALUES (NEW.id, _inv.company_id, _inv.role);
    PERFORM public.apply_invite_limit(_inv.company_id, NEW.id, _inv.monthly_limit);
    UPDATE public.company_invites SET accepted_at = now() WHERE id = _inv.id;
  ELSE
    INSERT INTO public.companies (name) VALUES (COALESCE(split_part(NEW.email, '@', 1), 'My') || '''s Team') RETURNING id INTO _company_id;
    UPDATE public.profiles SET company_id = _company_id WHERE user_id = NEW.id;
    INSERT INTO public.user_roles (user_id, company_id, role) VALUES (NEW.id, _company_id, 'admin');
    INSERT INTO public.company_onboarding (company_id) VALUES (_company_id) ON CONFLICT (company_id) DO NOTHING;
  END IF;
  RETURN NEW;
END; $function$;