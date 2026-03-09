-- Fix: Remove overly permissive INSERT policy on email_events
-- The webhook edge function uses the service_role key which bypasses RLS entirely
-- so this public INSERT policy is unnecessary and a security risk
DROP POLICY IF EXISTS "Service role can insert email events" ON public.email_events;