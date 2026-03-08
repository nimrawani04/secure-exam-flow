
-- Drop the existing exam_cell SELECT policy
DROP POLICY IF EXISTS "Exam cell can view approved papers" ON public.exam_papers;

-- Recreate with resubmission_requested included
CREATE POLICY "Exam cell can view approved papers"
ON public.exam_papers
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'exam_cell'::app_role)
  AND (status = ANY (ARRAY['approved'::paper_status, 'locked'::paper_status, 'resubmission_requested'::paper_status]))
);

-- Allow exam_cell to update paper status (needed for resubmission requests)
CREATE POLICY "Exam cell can update paper status"
ON public.exam_papers
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'exam_cell'::app_role)
  AND (status = ANY (ARRAY['approved'::paper_status, 'locked'::paper_status]))
);
