CREATE TABLE IF NOT EXISTS public.internal_job_token (id int PRIMARY KEY DEFAULT 1 CHECK (id = 1), token text NOT NULL);
REVOKE ALL ON public.internal_job_token FROM anon, authenticated, public;
GRANT ALL ON public.internal_job_token TO service_role;
ALTER TABLE public.internal_job_token ENABLE ROW LEVEL SECURITY;
INSERT INTO public.internal_job_token (id, token) VALUES (1, encode(extensions.gen_random_bytes(32), 'hex')) ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.internal_job_headers()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object('Content-Type','application/json','x-oslr-job-token',(SELECT token FROM public.internal_job_token WHERE id = 1));
$$;
REVOKE EXECUTE ON FUNCTION public.internal_job_headers() FROM anon, authenticated, public;

CREATE OR REPLACE FUNCTION public.wake_export_sync()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM net.http_post(url:='https://pagxfpeqjxlbaoldmeua.supabase.co/functions/v1/export-sync', headers:=public.internal_job_headers(), body:='{}'::jsonb);
END $$;

SELECT cron.alter_job(jobid, command := $c$select net.http_post(url:='https://pagxfpeqjxlbaoldmeua.supabase.co/functions/v1/agents-tick', headers:=public.internal_job_headers(), body:='{}'::jsonb) as request$c$) FROM cron.job WHERE jobname = 'oslr-agents-tick-hourly';
SELECT cron.alter_job(jobid, command := $c$select net.http_post(url:='https://pagxfpeqjxlbaoldmeua.supabase.co/functions/v1/stripe-webhook', headers:=public.internal_job_headers(), body:='{"tick":true}'::jsonb)$c$) FROM cron.job WHERE jobname = 'billing-nudges-hourly';