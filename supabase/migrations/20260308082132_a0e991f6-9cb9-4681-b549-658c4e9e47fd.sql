
-- Recreate as explicitly PERMISSIVE (AS clause comes right after policy name)
CREATE POLICY "Exam cell can update paper status permissive"
ON public.exam_papers
AS PERMISSIVE
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'exam_cell'::app_role) 
  AND (status = ANY (ARRAY['approved'::paper_status, 'locked'::paper_status, 'review_requested'::paper_status]))
)
WITH CHECK (
  has_role(auth.uid(), 'exam_cell'::app_role) 
  AND (status = ANY (ARRAY['approved'::paper_status, 'locked'::paper_status, 'resubmission_requested'::paper_status, 'review_requested'::paper_status, 'pending_review'::paper_status]))
);
