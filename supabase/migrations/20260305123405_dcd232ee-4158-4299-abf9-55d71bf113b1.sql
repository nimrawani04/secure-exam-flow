
-- Create paper_requests table for exam cell to request new papers
CREATE TABLE public.paper_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  exam_id UUID REFERENCES public.exams(id) ON DELETE CASCADE NOT NULL,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE NOT NULL,
  exam_type public.exam_type NOT NULL,
  department_id UUID REFERENCES public.departments(id) ON DELETE CASCADE NOT NULL,
  reason TEXT NOT NULL,
  remarks TEXT NOT NULL,
  urgency TEXT NOT NULL DEFAULT 'normal',
  status TEXT NOT NULL DEFAULT 'pending',
  requested_by UUID NOT NULL,
  resolved_by UUID,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.paper_requests ENABLE ROW LEVEL SECURITY;

-- Exam cell can manage paper requests
CREATE POLICY "Exam cell can manage paper requests"
  ON public.paper_requests
  FOR ALL
  USING (has_role(auth.uid(), 'exam_cell'::app_role))
  WITH CHECK (has_role(auth.uid(), 'exam_cell'::app_role));

-- HOD can view requests for their department
CREATE POLICY "HOD can view department paper requests"
  ON public.paper_requests
  FOR SELECT
  USING (
    has_role(auth.uid(), 'hod'::app_role)
    AND department_id = get_user_department(auth.uid())
  );

-- HOD can update requests for their department (to resolve them)
CREATE POLICY "HOD can update department paper requests"
  ON public.paper_requests
  FOR UPDATE
  USING (
    has_role(auth.uid(), 'hod'::app_role)
    AND department_id = get_user_department(auth.uid())
  );

-- Admin can view all
CREATE POLICY "Admin can view all paper requests"
  ON public.paper_requests
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));
