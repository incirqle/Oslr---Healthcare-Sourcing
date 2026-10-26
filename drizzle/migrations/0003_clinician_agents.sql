CREATE TABLE public.company_features (
  company_id uuid PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  agents_enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.company_features TO authenticated;
GRANT ALL ON public.company_features TO service_role;
ALTER TABLE public.company_features ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read their features" ON public.company_features FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));

CREATE TABLE public.clin_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  owner_id uuid NOT NULL,
  name text NOT NULL,
  brief text NOT NULL,
  status text NOT NULL DEFAULT 'calibrating',
  per_day integer NOT NULL DEFAULT 10,
  goal integer,
  finish_date date,
  run_hour integer NOT NULL DEFAULT 9,
  timezone text NOT NULL DEFAULT 'America/New_York',
  next_run_at timestamptz,
  last_run_at timestamptz,
  empty_runs integer NOT NULL DEFAULT 0,
  taste_memo text,
  preferences jsonb NOT NULL DEFAULT '{"weights":{},"skip":{"cities":[],"employers":[]}}'::jsonb,
  email_updates boolean NOT NULL DEFAULT true,
  pause_reason text,
  last_reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX clin_agents_company_idx ON public.clin_agents(company_id);
CREATE INDEX clin_agents_due_idx ON public.clin_agents(status, next_run_at);
GRANT SELECT ON public.clin_agents TO authenticated;
GRANT ALL ON public.clin_agents TO service_role;
ALTER TABLE public.clin_agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read agents" ON public.clin_agents FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));
CREATE TRIGGER update_clin_agents_updated_at BEFORE UPDATE ON public.clin_agents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.clin_agent_pool (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.clin_agents(id) ON DELETE CASCADE,
  company_id uuid NOT NULL,
  person_id text NOT NULL,
  profile jsonb NOT NULL,
  features text[] NOT NULL DEFAULT '{}',
  why text,
  base_score double precision NOT NULL DEFAULT 0.5,
  boost double precision NOT NULL DEFAULT 1,
  final_score double precision NOT NULL DEFAULT 0.5,
  served_at timestamptz,
  decision text,
  decided_at timestamptz,
  pruned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agent_id, person_id)
);
CREATE INDEX clin_agent_pool_agent_idx ON public.clin_agent_pool(agent_id, decision);
GRANT SELECT ON public.clin_agent_pool TO authenticated;
GRANT ALL ON public.clin_agent_pool TO service_role;
ALTER TABLE public.clin_agent_pool ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read pool" ON public.clin_agent_pool FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));

CREATE TABLE public.clin_agent_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.clin_agents(id) ON DELETE CASCADE,
  company_id uuid NOT NULL,
  pool_id uuid NOT NULL REFERENCES public.clin_agent_pool(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  decision text NOT NULL,
  tags text[] NOT NULL DEFAULT '{}',
  note text,
  skip_city text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX clin_agent_decisions_agent_idx ON public.clin_agent_decisions(agent_id, created_at);
GRANT SELECT ON public.clin_agent_decisions TO authenticated;
GRANT ALL ON public.clin_agent_decisions TO service_role;
ALTER TABLE public.clin_agent_decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read decisions" ON public.clin_agent_decisions FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));

CREATE TABLE public.clin_agent_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.clin_agents(id) ON DELETE CASCADE,
  company_id uuid NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX clin_agent_events_agent_idx ON public.clin_agent_events(agent_id, created_at);
GRANT SELECT ON public.clin_agent_events TO authenticated;
GRANT ALL ON public.clin_agent_events TO service_role;
ALTER TABLE public.clin_agent_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read events" ON public.clin_agent_events FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));

CREATE TABLE public.clin_agent_lease (
  id integer PRIMARY KEY,
  locked_until timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.clin_agent_lease TO service_role;
ALTER TABLE public.clin_agent_lease ENABLE ROW LEVEL SECURITY;
INSERT INTO public.clin_agent_lease (id) VALUES (1);