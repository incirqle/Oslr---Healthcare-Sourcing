
-- Role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'recruiter', 'viewer');

-- Companies table
CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Profiles table (linked to auth.users and companies)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  full_name TEXT,
  avatar_url TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- User roles table (source of truth for RBAC)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'viewer',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, company_id)
);

-- Projects table
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Candidates table
CREATE TABLE public.candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  pdl_id TEXT,
  full_name TEXT NOT NULL,
  title TEXT,
  current_employer TEXT,
  location TEXT,
  email TEXT,
  phone TEXT,
  linkedin_url TEXT,
  salary_min INTEGER,
  salary_max INTEGER,
  avg_tenure_months INTEGER,
  skills TEXT[],
  raw_data JSONB,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'interested', 'hired', 'rejected')),
  notes TEXT,
  tags TEXT[],
  added_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Search history table
CREATE TABLE public.search_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  query_text TEXT NOT NULL,
  pdl_params JSONB,
  result_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Helper function: get user's company_id
CREATE OR REPLACE FUNCTION public.get_user_company_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM public.profiles WHERE user_id = _user_id LIMIT 1;
$$;

-- Helper function: check if user belongs to a company
CREATE OR REPLACE FUNCTION public.is_company_member(_user_id UUID, _company_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = _user_id AND company_id = _company_id
  );
$$;

-- Helper function: check role (uses user_roles table)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

-- Helper: has role in specific company
CREATE OR REPLACE FUNCTION public.has_company_role(_user_id UUID, _company_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND company_id = _company_id AND role = _role
  );
$$;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_candidates_updated_at BEFORE UPDATE ON public.candidates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS on all tables
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.search_history ENABLE ROW LEVEL SECURITY;

-- COMPANIES policies
CREATE POLICY "Members can view their company" ON public.companies FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), id));

CREATE POLICY "Authenticated users can create companies" ON public.companies FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can update their company" ON public.companies FOR UPDATE TO authenticated
  USING (public.has_company_role(auth.uid(), id, 'admin'));

-- PROFILES policies
CREATE POLICY "Users can view profiles in their company" ON public.profiles FOR SELECT TO authenticated
  USING (company_id IS NULL OR public.is_company_member(auth.uid(), company_id) OR user_id = auth.uid());

CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- USER_ROLES policies
CREATE POLICY "Company members can view roles in their company" ON public.user_roles FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));

CREATE POLICY "Admins can insert roles" ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (public.has_company_role(auth.uid(), company_id, 'admin'));

CREATE POLICY "Admins can update roles" ON public.user_roles FOR UPDATE TO authenticated
  USING (public.has_company_role(auth.uid(), company_id, 'admin'));

CREATE POLICY "Admins can delete roles" ON public.user_roles FOR DELETE TO authenticated
  USING (public.has_company_role(auth.uid(), company_id, 'admin'));

-- PROJECTS policies
CREATE POLICY "Company members can view projects" ON public.projects FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));

CREATE POLICY "Admins and recruiters can create projects" ON public.projects FOR INSERT TO authenticated
  WITH CHECK (
    public.has_company_role(auth.uid(), company_id, 'admin')
    OR public.has_company_role(auth.uid(), company_id, 'recruiter')
  );

CREATE POLICY "Admins and recruiters can update projects" ON public.projects FOR UPDATE TO authenticated
  USING (
    public.has_company_role(auth.uid(), company_id, 'admin')
    OR public.has_company_role(auth.uid(), company_id, 'recruiter')
  );

CREATE POLICY "Admins can delete projects" ON public.projects FOR DELETE TO authenticated
  USING (public.has_company_role(auth.uid(), company_id, 'admin'));

-- CANDIDATES policies
CREATE POLICY "Company members can view candidates" ON public.candidates FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));

CREATE POLICY "Admins and recruiters can add candidates" ON public.candidates FOR INSERT TO authenticated
  WITH CHECK (
    public.has_company_role(auth.uid(), company_id, 'admin')
    OR public.has_company_role(auth.uid(), company_id, 'recruiter')
  );

CREATE POLICY "Admins and recruiters can update candidates" ON public.candidates FOR UPDATE TO authenticated
  USING (
    public.has_company_role(auth.uid(), company_id, 'admin')
    OR public.has_company_role(auth.uid(), company_id, 'recruiter')
  );

CREATE POLICY "Admins and recruiters can delete candidates" ON public.candidates FOR DELETE TO authenticated
  USING (
    public.has_company_role(auth.uid(), company_id, 'admin')
    OR public.has_company_role(auth.uid(), company_id, 'recruiter')
  );

-- SEARCH_HISTORY policies
CREATE POLICY "Users can view their own search history" ON public.search_history FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert search history" ON public.search_history FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_company_member(auth.uid(), company_id));

CREATE POLICY "Users can delete their own search history" ON public.search_history FOR DELETE TO authenticated
  USING (user_id = auth.uid());
