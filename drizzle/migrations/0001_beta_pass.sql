CREATE TABLE public.beta_access (
  company_id uuid PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  activated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '5 days',
  search_limit integer NOT NULL DEFAULT 5,
  enrich_limit integer NOT NULL DEFAULT 5
);
GRANT SELECT ON public.beta_access TO authenticated;
GRANT ALL ON public.beta_access TO service_role;
ALTER TABLE public.beta_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read beta" ON public.beta_access FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));

CREATE TABLE public.beta_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid,
  user_id uuid NOT NULL,
  user_email text,
  experience text,
  intuitive text,
  easy_to_use text,
  suggestions text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT, SELECT ON public.beta_feedback TO authenticated;
GRANT ALL ON public.beta_feedback TO service_role;
ALTER TABLE public.beta_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own feedback insert" ON public.beta_feedback FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own feedback read" ON public.beta_feedback FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.redeem_beta_code(_code text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _cid uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_signed_in'; END IF;
  IF lower(trim(_code)) <> 'olsrfriends2026' THEN RETURN false; END IF;
  _cid := public.get_user_company_id(auth.uid());
  IF _cid IS NULL THEN RAISE EXCEPTION 'no_workspace'; END IF;
  IF EXISTS (SELECT 1 FROM public.beta_access WHERE company_id = _cid) THEN RETURN true; END IF;
  INSERT INTO public.beta_access (company_id, user_id) VALUES (_cid, auth.uid());
  PERFORM public.grant_paid_credits(_cid, 25, 'beta:' || _cid::text, 'Beta pass');
  RETURN true;
END; $$;
GRANT EXECUTE ON FUNCTION public.redeem_beta_code(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.beta_status()
RETURNS TABLE(active boolean, expires_at timestamptz, searches_used integer, search_limit integer, enriches_used integer, enrich_limit integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT
    (now() < b.expires_at AND s.n < b.search_limit AND e.n < b.enrich_limit),
    b.expires_at, s.n, b.search_limit, e.n, b.enrich_limit
  FROM public.beta_access b
  CROSS JOIN LATERAL (SELECT count(*)::int n FROM public.search_history h WHERE h.company_id = b.company_id AND h.created_at >= b.activated_at) s
  CROSS JOIN LATERAL (SELECT count(DISTINCT t.linkedin_url)::int n FROM public.credit_transactions t WHERE t.company_id = b.company_id AND t.credits < 0 AND t.created_at >= b.activated_at) e
  WHERE b.company_id = public.get_user_company_id(auth.uid());
$$;
GRANT EXECUTE ON FUNCTION public.beta_status() TO authenticated;