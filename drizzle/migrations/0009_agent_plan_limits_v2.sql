CREATE OR REPLACE FUNCTION public.enforce_clin_agent_metering()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_plan text; v_enabled boolean; v_limit integer; v_count integer; v_daily integer;
BEGIN
  IF TG_OP = 'UPDATE' AND (NEW.company_id <> OLD.company_id OR NEW.owner_id <> OLD.owner_id OR NEW.creation_request_id IS DISTINCT FROM OLD.creation_request_id) THEN
    RAISE EXCEPTION 'Agent ownership and creation reference cannot be changed.';
  END IF;
  SELECT plan, agents_enabled INTO v_plan, v_enabled FROM public.company_features WHERE company_id = NEW.company_id;
  v_daily := CASE WHEN v_plan = 'enterprise' THEN 50 WHEN v_plan = 'pro' THEN 25 ELSE 10 END;
  IF NEW.per_day > v_daily THEN NEW.per_day := v_daily; END IF;
  IF TG_OP = 'UPDATE' AND (NEW.status NOT IN ('calibrating','sourcing') OR OLD.status IN ('calibrating','sourcing')) THEN
    RETURN NEW;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('clin-agent:' || NEW.company_id::text, 0));
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = NEW.owner_id AND company_id = NEW.company_id) THEN
    RAISE EXCEPTION 'No workspace found.';
  END IF;
  PERFORM 1 FROM public.company_features WHERE company_id = NEW.company_id FOR UPDATE;
  IF NOT coalesce(v_enabled, false) AND coalesce(v_plan,'') NOT IN ('starter','pro','enterprise') THEN
    RAISE EXCEPTION 'Agents are not turned on for your team.';
  END IF;
  v_limit := CASE WHEN v_plan = 'enterprise' THEN NULL WHEN v_plan = 'pro' THEN 4 ELSE 1 END;
  IF NEW.status IN ('calibrating','sourcing') AND v_limit IS NOT NULL THEN
    SELECT count(*) INTO v_count FROM public.clin_agents
      WHERE company_id = NEW.company_id AND status IN ('calibrating','sourcing') AND id <> NEW.id
      AND (v_plan IS DISTINCT FROM 'pro' OR owner_id = NEW.owner_id);
    IF v_count >= v_limit THEN
      RAISE EXCEPTION 'You have reached your active agent limit (%). Pause or close an agent first.', v_limit;
    END IF;
  END IF;
  IF TG_OP = 'INSERT' THEN
    UPDATE public.credit_balances SET balance = balance - 15, updated_at = now()
      WHERE company_id = NEW.company_id AND balance >= 15;
    IF NOT FOUND THEN RAISE EXCEPTION 'You need 15 credits to build an agent.'; END IF;
    INSERT INTO public.credit_transactions(company_id,user_id,kind,credits,note)
      VALUES (NEW.company_id,NEW.owner_id,'agent_build',-15,'Agent created: ' || NEW.name);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_metered_clin_agent(
  _company_id uuid, _owner_id uuid, _request_id uuid, _project_id uuid,
  _name text, _brief text, _per_day integer, _goal integer, _finish_date date, _timezone text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_agent public.clin_agents; v_project uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('clin-agent:' || _company_id::text, 0));
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = _owner_id AND company_id = _company_id) THEN
    RAISE EXCEPTION 'No workspace found.';
  END IF;
  SELECT * INTO v_agent FROM public.clin_agents WHERE owner_id = _owner_id AND creation_request_id = _request_id AND company_id = _company_id;
  IF FOUND THEN RETURN jsonb_build_object('agent',to_jsonb(v_agent),'reused',true); END IF;
  IF length(trim(_name)) = 0 OR length(trim(_brief)) < 8 THEN RAISE EXCEPTION 'Add a name and describe who to find.'; END IF;
  SELECT id INTO v_project FROM public.projects WHERE id = _project_id AND company_id = _company_id;
  IF v_project IS NULL THEN
    INSERT INTO public.projects(company_id,name,description,created_by) VALUES (_company_id,_name,_brief,_owner_id) RETURNING id INTO v_project;
  END IF;
  INSERT INTO public.clin_agents(company_id,project_id,owner_id,name,brief,per_day,goal,finish_date,timezone,status,creation_request_id)
    VALUES (_company_id,v_project,_owner_id,_name,_brief,greatest(1,_per_day),_goal,_finish_date,_timezone,'calibrating',_request_id)
    RETURNING * INTO v_agent;
  RETURN jsonb_build_object('agent',to_jsonb(v_agent),'reused',false);
END;
$$;