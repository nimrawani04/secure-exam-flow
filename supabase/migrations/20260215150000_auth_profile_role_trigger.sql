-- Create profiles and roles automatically on auth user creation.
-- Also backfill existing auth users missing profiles/roles.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  meta_full_name TEXT;
  meta_department TEXT;
  meta_role TEXT;
  department_uuid UUID;
BEGIN
  meta_full_name := NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), '');
  meta_department := NULLIF(TRIM(NEW.raw_user_meta_data->>'department_id'), '');
  meta_role := NULLIF(TRIM(NEW.raw_user_meta_data->>'role'), '');

  IF meta_department ~* '^[0-9a-f-]{36}$' THEN
    department_uuid := meta_department::uuid;
  ELSE
    department_uuid := NULL;
  END IF;

  INSERT INTO public.profiles (id, full_name, email, department_id)
  VALUES (
    NEW.id,
    COALESCE(meta_full_name, split_part(NEW.email, '@', 1), 'User'),
    NEW.email,
    department_uuid
  )
  ON CONFLICT (id) DO NOTHING;

  IF meta_role IN ('teacher', 'hod', 'exam_cell') THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, meta_role::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill profiles for existing users.
INSERT INTO public.profiles (id, full_name, email, department_id)
SELECT
  u.id,
  COALESCE(
    NULLIF(TRIM(u.raw_user_meta_data->>'full_name'), ''),
    split_part(u.email, '@', 1),
    'User'
  ) AS full_name,
  u.email,
  CASE
    WHEN NULLIF(TRIM(u.raw_user_meta_data->>'department_id'), '') ~* '^[0-9a-f-]{36}$'
    THEN (u.raw_user_meta_data->>'department_id')::uuid
    ELSE NULL
  END AS department_id
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;

-- Backfill user_roles for existing users.
INSERT INTO public.user_roles (user_id, role)
SELECT
  u.id,
  (u.raw_user_meta_data->>'role')::public.app_role
FROM auth.users u
LEFT JOIN public.user_roles ur
  ON ur.user_id = u.id AND ur.role = (u.raw_user_meta_data->>'role')::public.app_role
WHERE ur.user_id IS NULL
  AND NULLIF(TRIM(u.raw_user_meta_data->>'role'), '') IN ('teacher', 'hod', 'exam_cell');
