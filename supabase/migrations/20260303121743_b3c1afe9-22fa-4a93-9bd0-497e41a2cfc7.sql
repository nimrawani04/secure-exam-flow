
-- Table to store parsed datesheet entries
CREATE TABLE public.datesheet_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_code text NOT NULL,
  course_name text,
  exam_date timestamp with time zone NOT NULL,
  exam_time text NOT NULL,
  semester integer,
  subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  deadline timestamp with time zone NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Trigger to auto-calculate deadline as exam_date - 3 days
CREATE OR REPLACE FUNCTION public.set_datesheet_deadline()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
BEGIN
  NEW.deadline := NEW.exam_date - interval '3 days';
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_datesheet_deadline
  BEFORE INSERT OR UPDATE ON public.datesheet_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.set_datesheet_deadline();

-- Enable RLS
ALTER TABLE public.datesheet_entries ENABLE ROW LEVEL SECURITY;

-- Exam Cell can manage datesheet entries
CREATE POLICY "Exam cell can manage datesheet entries"
  ON public.datesheet_entries FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'exam_cell'))
  WITH CHECK (public.has_role(auth.uid(), 'exam_cell'));

-- Admin can view datesheet entries
CREATE POLICY "Admin can view datesheet entries"
  ON public.datesheet_entries FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- HOD can view department datesheet entries
CREATE POLICY "HOD can view department datesheet entries"
  ON public.datesheet_entries FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'hod') AND (
      subject_id IS NULL OR EXISTS (
        SELECT 1 FROM public.subjects s
        WHERE s.id = datesheet_entries.subject_id
        AND s.department_id = public.get_user_department(auth.uid())
      )
    )
  );

-- Teachers can view assigned datesheet entries
CREATE POLICY "Teachers can view assigned datesheet entries"
  ON public.datesheet_entries FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'teacher') AND EXISTS (
      SELECT 1 FROM public.teacher_subjects ts
      JOIN public.subjects s ON s.id = ts.subject_id
      WHERE ts.teacher_id = auth.uid()
      AND s.code = datesheet_entries.course_code
    )
  );

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.datesheet_entries;
