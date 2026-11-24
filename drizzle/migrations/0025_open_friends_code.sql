CREATE OR REPLACE FUNCTION public.redeem_beta_code(_code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _cid uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_signed_in'; END IF;
  IF lower(trim(_code)) NOT IN ('olsrfriends2026', 'oslrfriends2026') THEN RETURN false; END IF;
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