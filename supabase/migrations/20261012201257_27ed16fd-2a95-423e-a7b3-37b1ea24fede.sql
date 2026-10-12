CREATE TABLE public.credit_balances (
  company_id uuid PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  balance integer NOT NULL DEFAULT 0,
  monthly_allowance integer NOT NULL DEFAULT 150,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.credit_balances TO authenticated;
GRANT ALL ON public.credit_balances TO service_role;
ALTER TABLE public.credit_balances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view own workspace balance" ON public.credit_balances
  FOR SELECT TO authenticated USING (public.is_company_member(auth.uid(), company_id));

CREATE TABLE public.credit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid,
  kind text NOT NULL,
  credits integer NOT NULL,
  candidate_name text,
  linkedin_url text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX credit_transactions_company_idx ON public.credit_transactions (company_id, created_at DESC);
GRANT SELECT ON public.credit_transactions TO authenticated;
GRANT ALL ON public.credit_transactions TO service_role;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view own workspace transactions" ON public.credit_transactions
  FOR SELECT TO authenticated USING (public.is_company_member(auth.uid(), company_id));

CREATE TABLE public.contact_unlocks (
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  linkedin_url text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  checked jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, linkedin_url)
);
GRANT ALL ON public.contact_unlocks TO service_role;
ALTER TABLE public.contact_unlocks ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.spend_credits(_company_id uuid, _amount integer)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _new integer;
BEGIN
  UPDATE public.credit_balances SET balance = balance - _amount, updated_at = now()
  WHERE company_id = _company_id AND balance >= _amount
  RETURNING balance INTO _new;
  IF _new IS NULL THEN RAISE EXCEPTION 'insufficient_credits'; END IF;
  RETURN _new;
END; $$;
REVOKE ALL ON FUNCTION public.spend_credits(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.spend_credits(uuid, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.seed_company_credits()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO public.credit_balances (company_id, balance) VALUES (NEW.id, 150)
  ON CONFLICT (company_id) DO NOTHING;
  INSERT INTO public.credit_transactions (company_id, kind, credits, note)
  VALUES (NEW.id, 'grant', 150, 'Starter credits');
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_seed_company_credits AFTER INSERT ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.seed_company_credits();

INSERT INTO public.credit_balances (company_id, balance) SELECT id, 150 FROM public.companies
ON CONFLICT DO NOTHING;
INSERT INTO public.credit_transactions (company_id, kind, credits, note)
SELECT id, 'grant', 150, 'Starter credits' FROM public.companies;