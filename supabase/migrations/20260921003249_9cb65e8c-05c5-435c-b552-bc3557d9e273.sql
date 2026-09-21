-- Remove every remaining People Data Labs (PDL) artifact from the schema.
-- The search engine has run on Crustdata since 2026-09-14; the "pdl_*"
-- columns now hold Crustdata person ids / LinkedIn URLs and provider query
-- payloads. Rename them to say what they hold, and drop the dead cache table.

DROP TABLE IF EXISTS public.pdl_cache;

DO $$
BEGIN
  -- candidates.pdl_id -> person_id
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='candidates' AND column_name='pdl_id') THEN
    ALTER TABLE public.candidates RENAME COLUMN pdl_id TO person_id;
  END IF;

  -- candidate_notes.pdl_id -> person_id
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='candidate_notes' AND column_name='pdl_id') THEN
    ALTER TABLE public.candidate_notes RENAME COLUMN pdl_id TO person_id;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='idx_candidate_notes_user_pdl') THEN
    ALTER INDEX public.idx_candidate_notes_user_pdl RENAME TO idx_candidate_notes_user_person;
  END IF;

  -- candidate_fit.pdl_id -> person_id
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='candidate_fit' AND column_name='pdl_id') THEN
    ALTER TABLE public.candidate_fit RENAME COLUMN pdl_id TO person_id;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='idx_candidate_fit_pdl') THEN
    ALTER INDEX public.idx_candidate_fit_pdl RENAME TO idx_candidate_fit_person;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname='candidate_fit_user_id_pdl_id_key') THEN
    ALTER TABLE public.candidate_fit RENAME CONSTRAINT candidate_fit_user_id_pdl_id_key TO candidate_fit_user_id_person_id_key;
  END IF;

  -- people_enrichments.pdl_id -> person_id
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='people_enrichments' AND column_name='pdl_id') THEN
    ALTER TABLE public.people_enrichments RENAME COLUMN pdl_id TO person_id;
  END IF;

  -- agent_leads.pdl_person_id -> person_id
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='agent_leads' AND column_name='pdl_person_id') THEN
    ALTER TABLE public.agent_leads RENAME COLUMN pdl_person_id TO person_id;
  END IF;

  -- sourcing_agents.pdl_query -> source_query
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='sourcing_agents' AND column_name='pdl_query') THEN
    ALTER TABLE public.sourcing_agents RENAME COLUMN pdl_query TO source_query;
  END IF;

  -- search_audit_logs.pdl_query -> provider_query
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='search_audit_logs' AND column_name='pdl_query') THEN
    ALTER TABLE public.search_audit_logs RENAME COLUMN pdl_query TO provider_query;
  END IF;

  -- search_history.pdl_params -> search_params
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='search_history' AND column_name='pdl_params') THEN
    ALTER TABLE public.search_history RENAME COLUMN pdl_params TO search_params;
  END IF;
END $$;