CREATE OR REPLACE FUNCTION public.has_any_role(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id)
$$;

CREATE OR REPLACE FUNCTION public.list_public_departments()
RETURNS TABLE(id uuid, name text, code text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, name, code FROM public.departments ORDER BY name
$$;
GRANT EXECUTE ON FUNCTION public.list_public_departments() TO anon, authenticated;

DROP POLICY IF EXISTS "Authenticated can read crawl_queue" ON public.crawl_queue;

DROP POLICY IF EXISTS "Authenticated can read cuk_pages" ON public.cuk_pages;
CREATE POLICY "App users can read cuk_pages" ON public.cuk_pages
  FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));

DROP POLICY IF EXISTS "Subjects viewable by authenticated users" ON public.subjects;
CREATE POLICY "App users can view subjects" ON public.subjects
  FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));

DROP POLICY IF EXISTS "Departments are publicly viewable" ON public.departments;
CREATE POLICY "App users can view departments" ON public.departments
  FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));