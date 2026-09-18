-- Profiles: own profile or same-company teammates only
DROP POLICY IF EXISTS "Users can view profiles in their company" ON public.profiles;
CREATE POLICY "Users can view own or company profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR (company_id IS NOT NULL AND public.is_company_member(auth.uid(), company_id)));

-- Invites: no blanket read
DROP POLICY IF EXISTS "Anyone can read invite by token" ON public.company_invites;

CREATE OR REPLACE FUNCTION public.get_invite_by_token(_token text)
RETURNS TABLE (email text, company_name text, accepted boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT i.email, c.name, i.accepted_at IS NOT NULL
  FROM public.company_invites i
  JOIN public.companies c ON c.id = i.company_id
  WHERE i.token = _token
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_invite_by_token(text) TO anon, authenticated;

-- Shared caches: server-side only
DROP POLICY IF EXISTS "Authenticated users can read enrichments" ON public.people_enrichments;
DROP POLICY IF EXISTS "Authenticated users can read cache" ON public.pdl_cache;
DROP POLICY IF EXISTS "Authenticated users can read company enrichment cache" ON public.company_enrichment_cache;
REVOKE SELECT ON public.people_enrichments FROM authenticated, anon;
REVOKE SELECT ON public.pdl_cache FROM authenticated, anon;
REVOKE SELECT ON public.company_enrichment_cache FROM authenticated, anon;
GRANT ALL ON public.people_enrichments TO service_role;
GRANT ALL ON public.pdl_cache TO service_role;
GRANT ALL ON public.company_enrichment_cache TO service_role;