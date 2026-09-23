CREATE TABLE public.examiner_panels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id uuid NOT NULL REFERENCES public.departments(id),
  school text,
  department_label text,
  programme text,
  semester text,
  session_label text,
  course_title text,
  course_code text,
  subject_id uuid REFERENCES public.subjects(id),
  status text NOT NULL DEFAULT 'draft',
  head_name text,
  dean_name text,
  notes text,
  created_by uuid NOT NULL,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.examiner_panel_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  panel_id uuid NOT NULL REFERENCES public.examiner_panels(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 1,
  name text NOT NULL,
  designation text,
  specialization text,
  postal_address text,
  contact_details text,
  status text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_examiner_panels_dept ON public.examiner_panels(department_id);
CREATE INDEX idx_examiner_panel_members_panel ON public.examiner_panel_members(panel_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.examiner_panels TO authenticated;
GRANT ALL ON public.examiner_panels TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.examiner_panel_members TO authenticated;
GRANT ALL ON public.examiner_panel_members TO service_role;

ALTER TABLE public.examiner_panels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.examiner_panel_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "HOD manages own department panels"
ON public.examiner_panels FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'hod'::app_role) AND department_id = public.get_user_department(auth.uid()))
WITH CHECK (public.has_role(auth.uid(), 'hod'::app_role) AND department_id = public.get_user_department(auth.uid()) AND created_by = auth.uid());

CREATE POLICY "Exam cell reads sent panels"
ON public.examiner_panels FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'exam_cell'::app_role) AND status = 'sent');

CREATE POLICY "HOD manages own department panel members"
ON public.examiner_panel_members FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.examiner_panels p
  WHERE p.id = panel_id
    AND public.has_role(auth.uid(), 'hod'::app_role)
    AND p.department_id = public.get_user_department(auth.uid())
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.examiner_panels p
  WHERE p.id = panel_id
    AND public.has_role(auth.uid(), 'hod'::app_role)
    AND p.department_id = public.get_user_department(auth.uid())
));

CREATE POLICY "Exam cell reads sent panel members"
ON public.examiner_panel_members FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.examiner_panels p
  WHERE p.id = panel_id
    AND public.has_role(auth.uid(), 'exam_cell'::app_role)
    AND p.status = 'sent'
));

CREATE TRIGGER update_examiner_panels_updated_at
BEFORE UPDATE ON public.examiner_panels
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();