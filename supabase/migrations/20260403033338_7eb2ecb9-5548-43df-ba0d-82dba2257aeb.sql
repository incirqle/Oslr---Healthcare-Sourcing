
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _company_id uuid;
BEGIN
  -- Create profile
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );

  -- Create a company for the user
  INSERT INTO public.companies (name)
  VALUES (COALESCE(split_part(NEW.email, '@', 1), 'My') || '''s Team')
  RETURNING id INTO _company_id;

  -- Link profile to company
  UPDATE public.profiles
  SET company_id = _company_id
  WHERE user_id = NEW.id;

  -- Assign admin role
  INSERT INTO public.user_roles (user_id, company_id, role)
  VALUES (NEW.id, _company_id, 'admin');

  RETURN NEW;
END;
$$;

-- Recreate the trigger (drop first to be safe)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
