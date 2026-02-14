
-- Email templates table
CREATE TABLE public.email_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  subject TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can view templates"
  ON public.email_templates FOR SELECT
  USING (is_company_member(auth.uid(), company_id));

CREATE POLICY "Admins and recruiters can create templates"
  ON public.email_templates FOR INSERT
  WITH CHECK (has_company_role(auth.uid(), company_id, 'admin') OR has_company_role(auth.uid(), company_id, 'recruiter'));

CREATE POLICY "Admins and recruiters can update templates"
  ON public.email_templates FOR UPDATE
  USING (has_company_role(auth.uid(), company_id, 'admin') OR has_company_role(auth.uid(), company_id, 'recruiter'));

CREATE POLICY "Admins and recruiters can delete templates"
  ON public.email_templates FOR DELETE
  USING (has_company_role(auth.uid(), company_id, 'admin') OR has_company_role(auth.uid(), company_id, 'recruiter'));

CREATE TRIGGER update_email_templates_updated_at
  BEFORE UPDATE ON public.email_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Email campaigns table
CREATE TABLE public.email_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  template_id UUID REFERENCES public.email_templates(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  recipient_count INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.email_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can view campaigns"
  ON public.email_campaigns FOR SELECT
  USING (is_company_member(auth.uid(), company_id));

CREATE POLICY "Admins and recruiters can create campaigns"
  ON public.email_campaigns FOR INSERT
  WITH CHECK (has_company_role(auth.uid(), company_id, 'admin') OR has_company_role(auth.uid(), company_id, 'recruiter'));

CREATE POLICY "Admins and recruiters can update campaigns"
  ON public.email_campaigns FOR UPDATE
  USING (has_company_role(auth.uid(), company_id, 'admin') OR has_company_role(auth.uid(), company_id, 'recruiter'));

CREATE POLICY "Admins and recruiters can delete campaigns"
  ON public.email_campaigns FOR DELETE
  USING (has_company_role(auth.uid(), company_id, 'admin') OR has_company_role(auth.uid(), company_id, 'recruiter'));

CREATE TRIGGER update_email_campaigns_updated_at
  BEFORE UPDATE ON public.email_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
