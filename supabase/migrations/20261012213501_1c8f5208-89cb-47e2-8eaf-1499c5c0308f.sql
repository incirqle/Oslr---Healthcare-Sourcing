ALTER TABLE public.credit_transactions ADD COLUMN stripe_ref text;
CREATE UNIQUE INDEX credit_transactions_stripe_ref_key ON public.credit_transactions (stripe_ref) WHERE stripe_ref IS NOT NULL;

CREATE OR REPLACE FUNCTION public.grant_paid_credits(_company_id uuid, _amount integer, _ref text, _note text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO public.credit_transactions (company_id, kind, credits, note, stripe_ref)
  VALUES (_company_id, 'grant', _amount, _note, _ref);
  INSERT INTO public.credit_balances (company_id, balance) VALUES (_company_id, _amount)
  ON CONFLICT (company_id) DO UPDATE SET balance = credit_balances.balance + _amount, updated_at = now();
  RETURN true;
EXCEPTION WHEN unique_violation THEN
  RETURN false;
END; $$;
REVOKE ALL ON FUNCTION public.grant_paid_credits(uuid, integer, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_paid_credits(uuid, integer, text, text) TO service_role;