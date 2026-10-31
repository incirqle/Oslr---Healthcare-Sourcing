ALTER TABLE public.export_outbox ADD COLUMN claimed_at timestamptz;

CREATE OR REPLACE FUNCTION public.claim_export_outbox(_limit integer DEFAULT 300)
RETURNS SETOF public.export_outbox LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.export_outbox o SET claimed_at = now()
  WHERE o.id IN (
    SELECT id FROM public.export_outbox
    WHERE processed_at IS NULL AND attempts < 5 AND (claimed_at IS NULL OR claimed_at < now() - interval '3 minutes')
    ORDER BY id LIMIT _limit FOR UPDATE SKIP LOCKED
  )
  RETURNING o.*;
$$;
REVOKE ALL ON FUNCTION public.claim_export_outbox(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_export_outbox(integer) TO service_role;

-- Placeholder; the deployment-specific version that calls the sync function is installed separately.
CREATE OR REPLACE FUNCTION public.wake_export_sync() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ BEGIN END $$;

CREATE OR REPLACE FUNCTION public.wake_export_sync_stmt()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.wake_export_sync();
  RETURN NULL;
END $$;
CREATE TRIGGER export_outbox_wake
AFTER INSERT ON public.export_outbox
FOR EACH STATEMENT EXECUTE FUNCTION public.wake_export_sync_stmt();