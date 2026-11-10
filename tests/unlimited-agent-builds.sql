-- Disposable rollback check: no provider requests, projects or agents remain.
BEGIN;
DO $$
DECLARE c uuid := 'd8346043-3a34-4b1a-a2f9-1f1a9b08490f'; u uuid := '77934e50-10b4-4d9d-b5aa-0ed7cf82752a'; a uuid; before_balance integer; before_debits integer;
BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id=u AND company_id=c) THEN RAISE EXCEPTION 'Founder workspace context missing'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.company_features WHERE company_id=c AND plan='enterprise') THEN RAISE EXCEPTION 'Expected Enterprise'; END IF;
 SELECT balance INTO before_balance FROM public.credit_balances WHERE company_id=c;
 SELECT count(*) INTO before_debits FROM public.credit_transactions WHERE company_id=c AND kind='agent_build';
 INSERT INTO public.clin_agents(company_id,owner_id,name,brief,status,per_day) VALUES(c,u,'Rollback access check','Cardiothoracic surgeons in Philadelphia','calibrating',50) RETURNING id INTO a;
 IF (SELECT per_day FROM public.clin_agents WHERE id=a)<>50 THEN RAISE EXCEPTION 'Expected 50 daily candidates'; END IF;
 IF (SELECT balance FROM public.credit_balances WHERE company_id=c)<>before_balance THEN RAISE EXCEPTION 'Unlimited pass charged credits'; END IF;
 IF (SELECT count(*) FROM public.credit_transactions WHERE company_id=c AND kind='agent_build')<>before_debits THEN RAISE EXCEPTION 'Unlimited pass wrote a debit'; END IF;
END $$;
ROLLBACK;