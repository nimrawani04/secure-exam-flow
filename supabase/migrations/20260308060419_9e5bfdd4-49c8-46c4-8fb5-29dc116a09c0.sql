
-- Add new exam types
ALTER TYPE public.exam_type ADD VALUE IF NOT EXISTS 'cia_1' AFTER 'internal';
ALTER TYPE public.exam_type ADD VALUE IF NOT EXISTS 'cia_2' AFTER 'cia_1';
ALTER TYPE public.exam_type ADD VALUE IF NOT EXISTS 'practical_external' AFTER 'cia_2';

-- Create department-level exam sessions table
CREATE TABLE public.department_exam_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  exam_type public.exam_type NOT NULL,
  semester integer NOT NULL,
  exam_date timestamp with time zone NOT NULL,
  submission_deadline timestamp with time zone NOT NULL,
  status text NOT NULL DEFAULT 'active',
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.department_exam_sessions ENABLE ROW LEVEL SECURITY;

-- HOD can manage their department's sessions
CREATE POLICY "HOD can manage department exam sessions"
ON public.department_exam_sessions
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'hod'::app_role)
  AND department_id = get_user_department(auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'hod'::app_role)
  AND department_id = get_user_department(auth.uid())
);

-- Exam cell can view all sessions (read-only oversight)
CREATE POLICY "Exam cell can view all department sessions"
ON public.department_exam_sessions
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'exam_cell'::app_role));

-- Admin can view all
CREATE POLICY "Admin can view all department sessions"
ON public.department_exam_sessions
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Teachers can view sessions for their assigned subjects
CREATE POLICY "Teachers can view assigned subject sessions"
ON public.department_exam_sessions
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'teacher'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.teacher_subjects ts
    WHERE ts.teacher_id = auth.uid() AND ts.subject_id = department_exam_sessions.subject_id
  )
);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.department_exam_sessions;
