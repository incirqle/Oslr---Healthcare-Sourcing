CREATE TABLE public.app_user_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  connector_id text NOT NULL,
  connection_key_ciphertext text NOT NULL,
  reconnect_required boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, connector_id)
);
GRANT ALL ON public.app_user_connections TO service_role;
ALTER TABLE public.app_user_connections ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.export_destinations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('google_sheets','slack','excel_feed')),
  created_by uuid NOT NULL,
  label text,
  spreadsheet_id text,
  sheet_url text,
  secret_ciphertext text,
  feed_token text UNIQUE,
  active boolean NOT NULL DEFAULT true,
  last_synced_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX export_destinations_project_idx ON public.export_destinations(project_id) WHERE active;
GRANT ALL ON public.export_destinations TO service_role;
ALTER TABLE public.export_destinations ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.export_rows (
  destination_id uuid NOT NULL REFERENCES public.export_destinations(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL,
  row_number integer NOT NULL,
  PRIMARY KEY (destination_id, candidate_id)
);
GRANT ALL ON public.export_rows TO service_role;
ALTER TABLE public.export_rows ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.export_outbox (
  id bigserial PRIMARY KEY,
  candidate_id uuid NOT NULL,
  project_id uuid NOT NULL,
  event text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  error text
);
CREATE INDEX export_outbox_pending_idx ON public.export_outbox(created_at) WHERE processed_at IS NULL;
GRANT ALL ON public.export_outbox TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.export_outbox_id_seq TO service_role;
ALTER TABLE public.export_outbox ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.enqueue_candidate_export()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_event text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.export_destinations WHERE project_id = NEW.project_id AND active) THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    v_event := 'added';
  ELSIF (NEW.email IS DISTINCT FROM OLD.email AND NEW.email IS NOT NULL) OR (NEW.phone IS DISTINCT FROM OLD.phone AND NEW.phone IS NOT NULL) THEN
    v_event := 'contact';
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    v_event := 'status';
  ELSIF NEW.notes IS DISTINCT FROM OLD.notes OR NEW.title IS DISTINCT FROM OLD.title OR NEW.current_employer IS DISTINCT FROM OLD.current_employer OR NEW.location IS DISTINCT FROM OLD.location THEN
    v_event := 'updated';
  ELSE
    RETURN NEW;
  END IF;
  INSERT INTO public.export_outbox(candidate_id, project_id, event) VALUES (NEW.id, NEW.project_id, v_event);
  RETURN NEW;
END $$;

CREATE TRIGGER candidates_enqueue_export
AFTER INSERT OR UPDATE ON public.candidates
FOR EACH ROW EXECUTE FUNCTION public.enqueue_candidate_export();