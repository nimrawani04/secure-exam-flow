CREATE TABLE public.panel_examiner_pool (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  email text,
  name text NOT NULL,
  designation text,
  specialization text,
  postal_address text,
  contact_details text,
  status text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.panel_examiner_pool TO authenticated;
GRANT ALL ON public.panel_examiner_pool TO service_role;
ALTER TABLE public.panel_examiner_pool ENABLE ROW LEVEL SECURITY;
CREATE POLICY "HOD manages own department examiner pool"
ON public.panel_examiner_pool FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'hod'::public.app_role) AND department_id = public.get_user_department(auth.uid()))
WITH CHECK (public.has_role(auth.uid(), 'hod'::public.app_role) AND department_id = public.get_user_department(auth.uid()));