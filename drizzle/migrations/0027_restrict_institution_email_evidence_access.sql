REVOKE ALL PRIVILEGES ON public.institution_email_evidence FROM anon, authenticated;
GRANT ALL ON public.institution_email_evidence TO service_role;
ALTER TABLE public.institution_email_evidence ENABLE ROW LEVEL SECURITY;