
-- Drop and recreate with proper WITH CHECK
DROP POLICY IF EXISTS "Exam cell can update paper status" ON public.exam_papers;

CREATE POLICY "Exam cell can update paper status"
ON public.exam_papers
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'exam_cell'::app_role)
  AND (status = ANY (ARRAY['approved'::paper_status, 'locked'::paper_status]))
)
WITH CHECK (
  has_role(auth.uid(), 'exam_cell'::app_role)
  AND (status = ANY (ARRAY['approved'::paper_status, 'locked'::paper_status, 'resubmission_requested'::paper_status]))
);
