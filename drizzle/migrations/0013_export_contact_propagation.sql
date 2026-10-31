CREATE OR REPLACE FUNCTION public.propagate_candidate_contact()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.linkedin_url IS NULL OR NEW.linkedin_url = '' THEN RETURN NEW; END IF;
  IF NEW.email IS NOT NULL AND NEW.email IS DISTINCT FROM OLD.email THEN
    UPDATE public.candidates SET email = NEW.email, updated_at = now()
      WHERE company_id = NEW.company_id AND linkedin_url = NEW.linkedin_url AND id <> NEW.id AND email IS NULL;
  END IF;
  IF NEW.phone IS NOT NULL AND NEW.phone IS DISTINCT FROM OLD.phone THEN
    UPDATE public.candidates SET phone = NEW.phone, updated_at = now()
      WHERE company_id = NEW.company_id AND linkedin_url = NEW.linkedin_url AND id <> NEW.id AND phone IS NULL;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER candidates_propagate_contact
AFTER UPDATE OF email, phone ON public.candidates
FOR EACH ROW EXECUTE FUNCTION public.propagate_candidate_contact();