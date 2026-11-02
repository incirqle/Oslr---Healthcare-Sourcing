CREATE TABLE public.member_credit_limits (company_id uuid NOT NULL REFERENCES public.companies(id), user_id uuid NOT NULL, monthly_limit integer NOT NULL CHECK (monthly_limit >= 0), updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(company_id,user_id));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.member_credit_limits TO authenticated;
GRANT ALL ON public.member_credit_limits TO service_role;
ALTER TABLE public.member_credit_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY limits_read ON public.member_credit_limits FOR SELECT TO authenticated USING (public.is_company_member(auth.uid(),company_id));
CREATE POLICY limits_admin ON public.member_credit_limits FOR ALL TO authenticated USING (public.has_company_role(auth.uid(),company_id,'admin')) WITH CHECK (public.has_company_role(auth.uid(),company_id,'admin') AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id=member_credit_limits.user_id AND p.company_id=member_credit_limits.company_id));
CREATE OR REPLACE FUNCTION public.enforce_member_credit_limit() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE cap integer; used integer; BEGIN
 IF NEW.credits >= 0 OR NEW.user_id IS NULL THEN RETURN NEW; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('member-cap:'||NEW.company_id::text,0));
 SELECT monthly_limit INTO cap FROM public.member_credit_limits WHERE company_id=NEW.company_id AND user_id=NEW.user_id;
 IF cap IS NULL THEN RETURN NEW; END IF;
 SELECT coalesce(sum(-credits),0)::integer INTO used FROM public.credit_transactions WHERE company_id=NEW.company_id AND user_id=NEW.user_id AND credits<0 AND created_at>=date_trunc('month',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
 IF used-NEW.credits>cap THEN RAISE EXCEPTION 'Your monthly credit limit has been reached. Ask your workspace admin to raise it.'; END IF; RETURN NEW; END; $$;
CREATE TRIGGER member_credit_cap BEFORE INSERT ON public.credit_transactions FOR EACH ROW EXECUTE FUNCTION public.enforce_member_credit_limit();
CREATE OR REPLACE FUNCTION public.member_credit_remaining(_company_id uuid,_user_id uuid) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE cap integer; used integer; BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' AND (auth.uid() IS DISTINCT FROM _user_id OR NOT public.is_company_member(auth.uid(),_company_id)) THEN RAISE EXCEPTION 'Forbidden'; END IF;
 SELECT monthly_limit INTO cap FROM public.member_credit_limits WHERE company_id=_company_id AND user_id=_user_id; IF cap IS NULL THEN RETURN NULL; END IF;
 SELECT coalesce(sum(-credits),0)::integer INTO used FROM public.credit_transactions WHERE company_id=_company_id AND user_id=_user_id AND credits<0 AND created_at>=date_trunc('month',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'; RETURN greatest(0,cap-used); END; $$;
REVOKE ALL ON FUNCTION public.member_credit_remaining(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.member_credit_remaining(uuid,uuid) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.charge_contact_credits(_company_id uuid,_user_id uuid,_kinds jsonb,_candidate_name text,_linkedin_url text) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE total integer; remaining integer; BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE company_id=_company_id AND user_id=_user_id) THEN RAISE EXCEPTION 'No workspace found'; END IF;
 SELECT sum((x->>'cost')::integer)::integer INTO total FROM jsonb_array_elements(_kinds) x; IF total IS NULL OR total<=0 THEN RAISE EXCEPTION 'Invalid charge'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('member-cap:'||_company_id::text,0));
 UPDATE public.credit_balances SET balance=balance-total,updated_at=now() WHERE company_id=_company_id AND balance>=total RETURNING balance INTO remaining;
 IF remaining IS NULL THEN RAISE EXCEPTION 'insufficient_credits'; END IF;
 INSERT INTO public.credit_transactions(company_id,user_id,kind,credits,candidate_name,linkedin_url) SELECT _company_id,_user_id,x->>'kind',-((x->>'cost')::integer),_candidate_name,_linkedin_url FROM jsonb_array_elements(_kinds) x;
 RETURN remaining; END; $$;
REVOKE ALL ON FUNCTION public.charge_contact_credits(uuid,uuid,jsonb,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.charge_contact_credits(uuid,uuid,jsonb,text,text) TO service_role;
CREATE OR REPLACE FUNCTION public.accept_workspace_invite(_token text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE inv public.company_invites; current_company uuid; BEGIN
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
 UPDATE public.company_invites SET accepted_at=now() WHERE id=inv.id;
 RETURN inv.company_id; END; $$;
REVOKE ALL ON FUNCTION public.accept_workspace_invite(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.accept_workspace_invite(text) TO authenticated;
CREATE OR REPLACE FUNCTION public.enforce_seat_limit() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE p text; seats integer; used integer; BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('workspace-invites:'||NEW.company_id::text,0));
 SELECT plan INTO p FROM public.company_features WHERE company_id=NEW.company_id;
 seats:=CASE WHEN p='enterprise' THEN NULL WHEN p='pro' THEN 5 ELSE 1 END;
 IF EXISTS(SELECT 1 FROM public.company_invites WHERE company_id=NEW.company_id AND lower(email)=lower(NEW.email) AND accepted_at IS NULL) OR EXISTS(SELECT 1 FROM public.profiles WHERE company_id=NEW.company_id AND lower(email)=lower(NEW.email)) THEN RAISE EXCEPTION 'This email already has a seat or pending invitation'; END IF;
 SELECT (SELECT count(*) FROM public.profiles WHERE company_id=NEW.company_id)+(SELECT count(*) FROM public.company_invites WHERE company_id=NEW.company_id AND accepted_at IS NULL) INTO used;
 IF seats IS NOT NULL AND used>=seats THEN RAISE EXCEPTION 'seat_limit_reached'; END IF; RETURN NEW; END; $$;
ALTER POLICY "Admins and recruiters can create invites" ON public.company_invites WITH CHECK (public.has_company_role(auth.uid(),company_id,'admin'));
CREATE OR REPLACE FUNCTION public.validate_signup_invite() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE t text; BEGIN t:=NEW.raw_user_meta_data->>'invite_token'; IF t IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.company_invites WHERE token=t AND accepted_at IS NULL AND lower(email)=lower(NEW.email)) THEN RAISE EXCEPTION 'Invitation is invalid or belongs to another email'; END IF; RETURN NEW; END; $$;
CREATE TRIGGER validate_oslr_signup_invite BEFORE INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.validate_signup_invite();