-- Add storage policies for exam-papers bucket
-- Teachers can upload their own files
CREATE POLICY "Teachers can upload exam papers"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'exam-papers' 
  AND has_role(auth.uid(), 'teacher'::app_role)
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Teachers can view their own uploaded files
CREATE POLICY "Teachers can view own exam papers"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'exam-papers'
  AND has_role(auth.uid(), 'teacher'::app_role)
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Teachers can update/replace their own files
CREATE POLICY "Teachers can update own exam papers"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'exam-papers'
  AND has_role(auth.uid(), 'teacher'::app_role)
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- HOD can view department papers (through exam_papers table join)
CREATE POLICY "HOD can view department exam papers"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'exam-papers'
  AND has_role(auth.uid(), 'hod'::app_role)
);

-- Exam cell can view approved papers
CREATE POLICY "Exam cell can view approved papers"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'exam-papers'
  AND has_role(auth.uid(), 'exam_cell'::app_role)
);