
-- Drop the existing restrictive policy and recreate as permissive
DROP POLICY IF EXISTS "Exam cell can update paper status" ON public.exam_papers;

CREATE POLICY "Exam cell can update paper status"
ON public.exam_papers
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
