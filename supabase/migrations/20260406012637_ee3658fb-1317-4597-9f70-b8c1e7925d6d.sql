
DROP POLICY "Teachers can update own draft papers" ON public.exam_papers;

CREATE POLICY "Teachers can update own papers" ON public.exam_papers
FOR UPDATE TO authenticated
USING (
  uploaded_by = auth.uid()
  AND has_role(auth.uid(), 'teacher'::app_role)
  AND status IN ('draft', 'rejected', 'pending_review')
)
WITH CHECK (
  uploaded_by = auth.uid()
  AND has_role(auth.uid(), 'teacher'::app_role)
  AND status IN ('draft', 'rejected')
);
