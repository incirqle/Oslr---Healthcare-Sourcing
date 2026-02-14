
-- Replace the overly permissive companies INSERT policy
DROP POLICY "Authenticated users can create companies" ON public.companies;

-- Only allow creating a company if the user doesn't already belong to one
CREATE POLICY "Users without a company can create one" ON public.companies FOR INSERT TO authenticated
  WITH CHECK (
    NOT EXISTS (
      SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND company_id IS NOT NULL
    )
  );
