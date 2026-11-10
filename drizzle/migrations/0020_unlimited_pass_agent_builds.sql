CREATE OR REPLACE FUNCTION public.enforce_clin_agent_metering()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_plan text; v_enabled boolean; v_limit integer; v_count integer; v_daily integer; v_invite boolean; v_unlimited boolean;
BEGIN
 IF TG_OP = 'UPDATE' AND (NEW.company_id <> OLD.company_id OR NEW.owner_id <> OLD.owner_id OR NEW.creation_request_id IS DISTINCT FROM OLD.creation_request_id) THEN RAISE EXCEPTION 'Agent ownership and creation reference cannot be changed.'; END IF;
 SELECT plan, agents_enabled INTO v_plan, v_enabled FROM public.company_features WHERE company_id = NEW.company_id;
 SELECT public.has_active_invite_pass(NEW.company_id) INTO v_invite;
 v_daily := CASE WHEN v_plan = 'enterprise' THEN 50 WHEN v_plan = 'pro' THEN 25 ELSE 10 END;
 IF NEW.per_day > v_daily THEN NEW.per_day := v_daily; END IF;
 IF TG_OP = 'UPDATE' AND (NEW.status NOT IN ('calibrating','sourcing') OR OLD.status IN ('calibrating','sourcing')) THEN RETURN NEW; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('clin-agent:' || NEW.company_id::text, 0));
 IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = NEW.owner_id AND company_id = NEW.company_id) THEN RAISE EXCEPTION 'No workspace found.'; END IF;
 PERFORM 1 FROM public.company_features WHERE company_id = NEW.company_id FOR UPDATE;
 IF NOT v_invite AND NOT coalesce(v_enabled, false) AND coalesce(v_plan,'') NOT IN ('starter','pro','enterprise') THEN RAISE EXCEPTION 'Agents are not turned on for your team.'; END IF;
 v_limit := CASE WHEN v_plan = 'enterprise' THEN NULL WHEN v_plan = 'pro' THEN 4 ELSE 1 END;
 IF NEW.status IN ('calibrating','sourcing') AND v_limit IS NOT NULL THEN
 SELECT count(*) INTO v_count FROM public.clin_agents WHERE company_id = NEW.company_id AND status IN ('calibrating','sourcing') AND id <> NEW.id AND (v_plan IS DISTINCT FROM 'pro' OR owner_id = NEW.owner_id);
 IF v_count >= v_limit THEN RAISE EXCEPTION 'You have reached your active agent limit (%). Pause or close an agent first.', v_limit; END IF;
 END IF;
 IF TG_OP = 'INSERT' THEN
 SELECT unlimited_access INTO v_unlimited FROM public.billing_exemptions WHERE company_id = NEW.company_id;
 IF NOT coalesce(v_unlimited, false) THEN
 UPDATE public.credit_balances SET balance = balance - 15, updated_at = now() WHERE company_id = NEW.company_id AND balance >= 15;
 IF NOT FOUND THEN RAISE EXCEPTION 'You need 15 credits to build an agent.'; END IF;
 INSERT INTO public.credit_transactions(company_id,user_id,kind,credits,note) VALUES (NEW.company_id,NEW.owner_id,'agent_build',-15,'Agent created: ' || NEW.name);
 END IF;
 END IF;
 RETURN NEW;
END;
$function$;