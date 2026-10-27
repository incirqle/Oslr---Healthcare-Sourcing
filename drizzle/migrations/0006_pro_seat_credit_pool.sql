-- Pro workspaces: every seat added to the team adds 500 credits to the shared monthly pool.
-- Fires when a member joins a workspace (profile gains a company_id, e.g. invite acceptance).
-- Keyed by company+user so a re-join can never grant twice.
CREATE OR REPLACE FUNCTION public.pro_seat_credit_grant()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _plan text;
BEGIN
  IF NEW.company_id IS NULL THEN RETURN NEW; END IF;
  IF OLD.company_id IS NOT NULL AND OLD.company_id = NEW.company_id THEN RETURN NEW; END IF;
  SELECT plan INTO _plan FROM public.company_features WHERE company_id = NEW.company_id;
  IF _plan = 'pro' THEN
    PERFORM public.grant_paid_credits(NEW.company_id, 500, 'seat:' || NEW.company_id::text || ':' || NEW.user_id::text, 'Pro seat added · 500 credits');
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.pro_seat_credit_grant() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS profiles_pro_seat_credit ON public.profiles;
CREATE TRIGGER profiles_pro_seat_credit AFTER INSERT OR UPDATE OF company_id ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.pro_seat_credit_grant();