CREATE OR REPLACE FUNCTION public.queue_signup_nudges()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.email IS NULL THEN RETURN NEW; END IF;
  IF NEW.company_id IS NOT NULL THEN
    UPDATE public.billing_nudges
      SET company_id = NEW.company_id
      WHERE company_id IS NULL
        AND lower(email) = lower(NEW.email)
        AND kind IN ('owner_signup', 'owner_unpaid', 'owner_unpaid_day');
  END IF;
  INSERT INTO public.billing_nudges(company_id,email,kind,dedupe_key,send_after) VALUES
    (NEW.company_id,NEW.email,'owner_signup','signup:'||NEW.user_id,now()),
    (NEW.company_id,NEW.email,'owner_unpaid','unpaid:'||NEW.user_id,now()+interval '2 hours'),
    (NEW.company_id,NEW.email,'owner_unpaid_day','unpaid-day:'||NEW.user_id,now()+interval '1 day')
  ON CONFLICT (dedupe_key) DO NOTHING;
  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS profiles_signup_nudges_company ON public.profiles;
CREATE TRIGGER profiles_signup_nudges_company
AFTER UPDATE OF company_id ON public.profiles
FOR EACH ROW
WHEN (OLD.company_id IS NULL AND NEW.company_id IS NOT NULL)
EXECUTE FUNCTION public.queue_signup_nudges();

REVOKE EXECUTE ON FUNCTION public.queue_signup_nudges() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.redeem_beta_code(_code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _cid uuid; _email text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_signed_in'; END IF;
  IF lower(trim(_code)) NOT IN ('olsrfriends2026', 'oslrfriends2026') THEN RETURN false; END IF;
  _email := lower(trim(coalesce(auth.jwt()->>'email', '')));
  IF _email = '' OR NOT EXISTS (
    SELECT 1 FROM public.beta_plan_invites WHERE lower(email) = _email
  ) THEN
    RAISE EXCEPTION 'invite_required';
  END IF;
  _cid := public.get_user_company_id(auth.uid());
  IF _cid IS NULL THEN RAISE EXCEPTION 'no_workspace'; END IF;
  IF EXISTS (SELECT 1 FROM public.beta_access WHERE company_id = _cid) THEN RETURN true; END IF;
  INSERT INTO public.beta_access (company_id, user_id, search_limit) VALUES (_cid, auth.uid(), 10);
  PERFORM public.grant_paid_credits(_cid, 25, 'beta:' || _cid::text, 'Beta pass');
  RETURN true;
END
$function$;

REVOKE EXECUTE ON FUNCTION public.redeem_beta_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_beta_code(text) TO authenticated;

UPDATE public.billing_nudges n
SET company_id = p.company_id
FROM public.profiles p
WHERE n.company_id IS NULL
  AND p.company_id IS NOT NULL
  AND lower(p.email) = lower(n.email)
  AND n.kind IN ('owner_signup', 'owner_unpaid', 'owner_unpaid_day');

UPDATE public.billing_nudges n
SET canceled_at = now()
WHERE n.kind IN ('owner_unpaid', 'owner_unpaid_day')
  AND n.sent_at IS NULL
  AND n.canceled_at IS NULL
  AND n.company_id IS NOT NULL
  AND (
    EXISTS (
      SELECT 1 FROM public.billing_events b
      WHERE b.company_id = n.company_id
        AND b.type IN ('checkout.session.completed', 'invoice.paid', 'invoice.payment_succeeded')
    )
    OR EXISTS (SELECT 1 FROM public.beta_access t WHERE t.company_id = n.company_id)
    OR EXISTS (SELECT 1 FROM public.billing_exemptions e WHERE e.company_id = n.company_id)
  );

DELETE FROM public.company_enrichment_cache
WHERE company_id = 1304813
  AND cache_key LIKE 'v%:base:%';