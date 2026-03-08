
-- The HOD and Teacher update policies are RESTRICTIVE which blocks Exam Cell updates
-- Recreate them as PERMISSIVE so each role's policy works independently

DROP POLICY IF EXISTS "HOD can update department papers for approval" ON public.exam_papers;
CREATE POLICY "HOD can update department papers for approval"
ON public.exam_papers
AS PERMISSIVE
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'hod'::app_role) AND (EXISTS ( SELECT 1
   FROM subjects s
  WHERE ((s.id = exam_papers.subject_id) AND (s.department_id = get_user_department(auth.uid())))))
);

DROP POLICY IF EXISTS "Teachers can update own draft papers" ON public.exam_papers;
CREATE POLICY "Teachers can update own draft papers"
ON public.exam_papers
AS PERMISSIVE
FOR UPDATE
TO authenticated
USING (
  (uploaded_by = auth.uid()) AND has_role(auth.uid(), 'teacher'::app_role) AND (status = ANY (ARRAY['draft'::paper_status, 'rejected'::paper_status]))
);
