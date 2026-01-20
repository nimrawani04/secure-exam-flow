-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('teacher', 'hod', 'exam_cell');

-- Create enum for paper status
CREATE TYPE public.paper_status AS ENUM ('draft', 'submitted', 'pending_review', 'approved', 'rejected', 'locked');

-- Create enum for exam types
CREATE TYPE public.exam_type AS ENUM ('mid_term', 'end_term', 'practical', 'internal');

-- Create enum for exam status
CREATE TYPE public.exam_status AS ENUM ('scheduled', 'in_progress', 'completed', 'archived');

-- Create departments table
CREATE TABLE public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create profiles table (basic user info)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  department_id UUID REFERENCES public.departments(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create user_roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Create subjects table
CREATE TABLE public.subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  department_id UUID REFERENCES public.departments(id) NOT NULL,
  semester INTEGER NOT NULL CHECK (semester >= 1 AND semester <= 8),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create teacher_subjects (many-to-many assignment)
CREATE TABLE public.teacher_subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (teacher_id, subject_id)
);

-- Create exam_papers table
CREATE TABLE public.exam_papers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID REFERENCES public.subjects(id) NOT NULL,
  exam_type exam_type NOT NULL,
  set_name TEXT NOT NULL CHECK (set_name IN ('A', 'B', 'C')),
  status paper_status NOT NULL DEFAULT 'draft',
  file_path TEXT, -- Storage path (not the actual file)
  uploaded_by UUID REFERENCES auth.users(id) NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deadline TIMESTAMPTZ NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  feedback TEXT,
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  is_selected BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (subject_id, exam_type, set_name, uploaded_by)
);

-- Create exams table (scheduled exams)
CREATE TABLE public.exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID REFERENCES public.subjects(id) NOT NULL,
  exam_type exam_type NOT NULL,
  scheduled_date TIMESTAMPTZ NOT NULL,
  unlock_time TIMESTAMPTZ NOT NULL,
  selected_paper_id UUID REFERENCES public.exam_papers(id),
  status exam_status NOT NULL DEFAULT 'scheduled',
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create audit_logs table
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('paper', 'exam', 'user')),
  entity_id UUID NOT NULL,
  ip_address INET,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_papers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Security definer function to check user role (prevents RLS recursion)
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
  )
$$;

-- Function to get user's department
CREATE OR REPLACE FUNCTION public.get_user_department(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT department_id FROM public.profiles WHERE id = _user_id
$$;

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_exam_papers_updated_at BEFORE UPDATE ON public.exam_papers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_exams_updated_at BEFORE UPDATE ON public.exams
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies for departments (readable by all authenticated users)
CREATE POLICY "Departments are viewable by authenticated users"
  ON public.departments FOR SELECT TO authenticated USING (true);

-- RLS Policies for profiles
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Users can view profiles in same department"
  ON public.profiles FOR SELECT TO authenticated
  USING (department_id = public.get_user_department(auth.uid()));

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

-- RLS Policies for user_roles (users can only see their own role)
CREATE POLICY "Users can view own role"
  ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- RLS Policies for subjects
CREATE POLICY "Subjects viewable by authenticated users"
  ON public.subjects FOR SELECT TO authenticated USING (true);

-- RLS Policies for teacher_subjects
CREATE POLICY "Teachers can view own subject assignments"
  ON public.teacher_subjects FOR SELECT TO authenticated
  USING (teacher_id = auth.uid());

CREATE POLICY "HOD can view department teacher assignments"
  ON public.teacher_subjects FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'hod') AND
    EXISTS (
      SELECT 1 FROM public.subjects s
      WHERE s.id = subject_id
      AND s.department_id = public.get_user_department(auth.uid())
    )
  );

-- RLS Policies for exam_papers
CREATE POLICY "Teachers can view own papers"
  ON public.exam_papers FOR SELECT TO authenticated
  USING (uploaded_by = auth.uid() AND public.has_role(auth.uid(), 'teacher'));

CREATE POLICY "Teachers can insert own papers"
  ON public.exam_papers FOR INSERT TO authenticated
  WITH CHECK (uploaded_by = auth.uid() AND public.has_role(auth.uid(), 'teacher'));

CREATE POLICY "Teachers can update own draft papers"
  ON public.exam_papers FOR UPDATE TO authenticated
  USING (
    uploaded_by = auth.uid() AND 
    public.has_role(auth.uid(), 'teacher') AND
    status IN ('draft', 'rejected')
  );

CREATE POLICY "HOD can view department papers (anonymous)"
  ON public.exam_papers FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'hod') AND
    EXISTS (
      SELECT 1 FROM public.subjects s
      WHERE s.id = subject_id
      AND s.department_id = public.get_user_department(auth.uid())
    )
  );

CREATE POLICY "HOD can update department papers for approval"
  ON public.exam_papers FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'hod') AND
    EXISTS (
      SELECT 1 FROM public.subjects s
      WHERE s.id = subject_id
      AND s.department_id = public.get_user_department(auth.uid())
    )
  );

CREATE POLICY "Exam cell can view approved papers"
  ON public.exam_papers FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'exam_cell') AND
    status IN ('approved', 'locked')
  );

-- RLS Policies for exams
CREATE POLICY "Exam cell can manage exams"
  ON public.exams FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'exam_cell'));

CREATE POLICY "HOD can view department exams"
  ON public.exams FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'hod') AND
    EXISTS (
      SELECT 1 FROM public.subjects s
      WHERE s.id = subject_id
      AND s.department_id = public.get_user_department(auth.uid())
    )
  );

CREATE POLICY "Teachers can view own subject exams"
  ON public.exams FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'teacher') AND
    EXISTS (
      SELECT 1 FROM public.teacher_subjects ts
      WHERE ts.teacher_id = auth.uid()
      AND ts.subject_id = subject_id
    )
  );

-- RLS Policies for audit_logs
CREATE POLICY "Users can view own audit logs"
  ON public.audit_logs FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "System can insert audit logs"
  ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Exam cell can view all audit logs"
  ON public.audit_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'exam_cell'));

-- Create storage bucket for exam papers
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('exam-papers', 'exam-papers', false, 52428800, ARRAY['application/pdf']);

-- Storage policies for exam papers bucket
CREATE POLICY "Teachers can upload papers"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'exam-papers' AND
    public.has_role(auth.uid(), 'teacher')
  );

CREATE POLICY "Teachers can view own papers"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'exam-papers' AND
    public.has_role(auth.uid(), 'teacher') AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Teachers can update own papers"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'exam-papers' AND
    public.has_role(auth.uid(), 'teacher') AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "HOD can view department papers"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'exam-papers' AND
    public.has_role(auth.uid(), 'hod')
  );

CREATE POLICY "Exam cell can view approved papers at unlock time"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'exam-papers' AND
    public.has_role(auth.uid(), 'exam_cell')
  );

-- Insert sample departments
INSERT INTO public.departments (name, code) VALUES
  ('Computer Science', 'CS'),
  ('Electronics', 'EC'),
  ('Mechanical', 'ME'),
  ('Civil', 'CE');

-- Insert sample subjects
INSERT INTO public.subjects (name, code, department_id, semester)
SELECT 'Data Structures', 'CS201', id, 3 FROM public.departments WHERE code = 'CS'
UNION ALL
SELECT 'Algorithms', 'CS301', id, 4 FROM public.departments WHERE code = 'CS'
UNION ALL
SELECT 'Database Systems', 'CS302', id, 4 FROM public.departments WHERE code = 'CS'
UNION ALL
SELECT 'Operating Systems', 'CS401', id, 5 FROM public.departments WHERE code = 'CS'
UNION ALL
SELECT 'Digital Electronics', 'EC201', id, 3 FROM public.departments WHERE code = 'EC'
UNION ALL
SELECT 'Signal Processing', 'EC301', id, 4 FROM public.departments WHERE code = 'EC';