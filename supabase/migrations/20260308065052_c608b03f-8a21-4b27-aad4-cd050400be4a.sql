
-- Create datesheets table
CREATE TABLE public.datesheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  annotations JSONB DEFAULT '[]'::jsonb,
  uploaded_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.datesheets ENABLE ROW LEVEL SECURITY;

-- Exam cell can fully manage datesheets
CREATE POLICY "Exam cell can manage datesheets"
  ON public.datesheets FOR ALL
  USING (has_role(auth.uid(), 'exam_cell'::app_role))
  WITH CHECK (has_role(auth.uid(), 'exam_cell'::app_role));

-- Admin can view datesheets
CREATE POLICY "Admin can view datesheets"
  ON public.datesheets FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- HOD can view datesheets
CREATE POLICY "HOD can view datesheets"
  ON public.datesheets FOR SELECT
  USING (has_role(auth.uid(), 'hod'::app_role));

-- Create storage bucket for datesheets
INSERT INTO storage.buckets (id, name, public)
VALUES ('datesheets', 'datesheets', false);

-- Storage policies for datesheets bucket
CREATE POLICY "Exam cell can upload datesheets"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'datesheets' AND has_role(auth.uid(), 'exam_cell'::app_role));

CREATE POLICY "Exam cell can read datesheets"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'datesheets' AND (
    has_role(auth.uid(), 'exam_cell'::app_role) OR
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'hod'::app_role)
  ));

CREATE POLICY "Exam cell can delete datesheets"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'datesheets' AND has_role(auth.uid(), 'exam_cell'::app_role));

CREATE POLICY "Exam cell can update datesheets"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'datesheets' AND has_role(auth.uid(), 'exam_cell'::app_role));
