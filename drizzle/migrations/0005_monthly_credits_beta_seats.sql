CREATE TABLE public.beta_plan_invites (
  email text PRIMARY KEY,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.beta_plan_invites TO service_role;
ALTER TABLE public.beta_plan_invites ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.reset_monthly_credits(_company_id uuid, _amount integer, _ref text, _note text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _old integer;
BEGIN
  INSERT INTO public.credit_transactions (company_id, kind, credits, note, stripe_ref)
  VALUES (_company_id, 'grant', _amount, _note, _ref);
  SELECT balance INTO _old FROM public.credit_balances WHERE company_id = _company_id FOR UPDATE;
  IF COALESCE(_old, 0) > 0 THEN
    INSERT INTO public.credit_transactions (company_id, kind, credits, note)
    VALUES (_company_id, 'expired', -_old, 'Unused credits from last month expired');
  END IF;
  INSERT INTO public.credit_balances (company_id, balance, monthly_allowance) VALUES (_company_id, _amount, _amount)
  ON CONFLICT (company_id) DO UPDATE SET balance = _amount, monthly_allowance = _amount, updated_at = now();
  RETURN true;
EXCEPTION WHEN unique_violation THEN
  RETURN false;
END; $$;
REVOKE ALL ON FUNCTION public.reset_monthly_credits(uuid, integer, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reset_monthly_credits(uuid, integer, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.enforce_seat_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _plan text; _seats integer; _used integer;
BEGIN
  SELECT plan INTO _plan FROM public.company_features WHERE company_id = NEW.company_id;
  _seats := CASE WHEN _plan = 'pro' THEN 5 ELSE 1 END;
  SELECT (SELECT count(*) FROM public.profiles WHERE company_id = NEW.company_id)
       + (SELECT count(*) FROM public.company_invites WHERE company_id = NEW.company_id AND accepted_at IS NULL)
    INTO _used;
  IF _used >= _seats THEN
    RAISE EXCEPTION 'seat_limit_reached' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS company_invites_seat_limit ON public.company_invites;
CREATE TRIGGER company_invites_seat_limit BEFORE INSERT ON public.company_invites
FOR EACH ROW EXECUTE FUNCTION public.enforce_seat_limit();