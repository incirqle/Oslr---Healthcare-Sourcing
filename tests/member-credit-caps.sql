-- Run inside a disposable transaction; always rolls back test data.
BEGIN;
DO $$
DECLARE c uuid; u uuid; before_balance integer; failed boolean := false;
BEGIN
 INSERT INTO public.companies(name) VALUES('Credit cap rollback test') RETURNING id INTO c;
 SELECT user_id INTO u FROM public.profiles LIMIT 1;
 IF u IS NULL THEN RAISE EXCEPTION 'An existing auth user is required for the rollback test'; END IF;
 UPDATE public.profiles SET company_id=c WHERE user_id=u;
 INSERT INTO public.member_credit_limits(company_id,user_id,monthly_limit) VALUES(c,u,3);
 UPDATE public.credit_balances SET balance=100 WHERE company_id=c;
 PERFORM public.charge_contact_credits(c,u,'[{"kind":"phone","cost":3}]'::jsonb,'Test','test:cap');
 SELECT balance INTO before_balance FROM public.credit_balances WHERE company_id=c;
 IF before_balance<>97 THEN RAISE EXCEPTION 'Expected 97 credits'; END IF;
 BEGIN
  PERFORM public.charge_contact_credits(c,u,'[{"kind":"work_email","cost":1}]'::jsonb,'Test','test:cap-two');
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM NOT LIKE '%monthly credit limit%' THEN RAISE; END IF; failed:=true;
 END;
 IF NOT failed THEN RAISE EXCEPTION 'Cap did not reject charge'; END IF;
 IF (SELECT balance FROM public.credit_balances WHERE company_id=c)<>97 THEN RAISE EXCEPTION 'Rejected debit changed balance'; END IF;
 IF (SELECT count(*) FROM public.credit_transactions WHERE company_id=c AND credits<0)<>1 THEN RAISE EXCEPTION 'Rejected debit changed ledger'; END IF;
END; $$;
ROLLBACK;
