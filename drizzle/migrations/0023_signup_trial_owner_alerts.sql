CREATE OR REPLACE FUNCTION public.wake_billing_tick() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  PERFORM net.http_post(url:='https://pagxfpeqjxlbaoldmeua.supabase.co/functions/v1/stripe-webhook', headers:=public.internal_job_headers(), body:='{"tick":true}'::jsonb);
  RETURN NULL;
EXCEPTION WHEN others THEN RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.queue_signup_nudges() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.email IS NULL THEN RETURN NEW; END IF;
  INSERT INTO public.billing_nudges(company_id,email,kind,dedupe_key,send_after) VALUES
    (NEW.company_id,NEW.email,'owner_signup','signup:'||NEW.user_id,now()),
    (NEW.company_id,NEW.email,'owner_unpaid','unpaid:'||NEW.user_id,now()+interval '2 hours'),
    (NEW.company_id,NEW.email,'owner_unpaid_day','unpaid-day:'||NEW.user_id,now()+interval '1 day')
  ON CONFLICT (dedupe_key) DO NOTHING;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.queue_trial_nudges() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE e text;
BEGIN
  SELECT email INTO e FROM public.profiles WHERE user_id=NEW.user_id;
  IF e IS NULL THEN RETURN NEW; END IF;
  INSERT INTO public.billing_nudges(company_id,email,kind,dedupe_key,send_after) VALUES
    (NEW.company_id,e,'owner_trial_started','trial-start:'||NEW.company_id,now()),
    (NEW.company_id,e,'trial_ending','trial-ending:'||NEW.company_id,NEW.expires_at-interval '1 day'),
    (NEW.company_id,e,'trial_ended','trial-ended:'||NEW.company_id,NEW.expires_at)
  ON CONFLICT (dedupe_key) DO NOTHING;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS profiles_signup_nudges ON public.profiles;
CREATE TRIGGER profiles_signup_nudges AFTER INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.queue_signup_nudges();
DROP TRIGGER IF EXISTS beta_access_trial_nudges ON public.beta_access;
CREATE TRIGGER beta_access_trial_nudges AFTER INSERT ON public.beta_access FOR EACH ROW EXECUTE FUNCTION public.queue_trial_nudges();
DROP TRIGGER IF EXISTS billing_nudges_wake ON public.billing_nudges;
CREATE TRIGGER billing_nudges_wake AFTER INSERT ON public.billing_nudges FOR EACH STATEMENT EXECUTE FUNCTION public.wake_billing_tick();

REVOKE EXECUTE ON FUNCTION public.wake_billing_tick(), public.queue_signup_nudges(), public.queue_trial_nudges() FROM PUBLIC, anon, authenticated;

-- Backfill: current trials still running get their ending/ended notices.
INSERT INTO public.billing_nudges(company_id,email,kind,dedupe_key,send_after)
SELECT b.company_id,p.email,k.kind,k.kind||':'||b.company_id, CASE k.kind WHEN 'trial_ending' THEN b.expires_at-interval '1 day' ELSE b.expires_at END
FROM public.beta_access b JOIN public.profiles p ON p.user_id=b.user_id
CROSS JOIN (VALUES ('trial-ending'),('trial-ended')) v(x)
CROSS JOIN LATERAL (SELECT CASE v.x WHEN 'trial-ending' THEN 'trial_ending' ELSE 'trial_ended' END kind) k
WHERE b.expires_at > now() AND p.email IS NOT NULL
ON CONFLICT (dedupe_key) DO NOTHING;