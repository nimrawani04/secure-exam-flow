
-- 1. Drop overly broad/duplicate storage policies
DROP POLICY IF EXISTS "HOD can view department papers" ON storage.objects;
DROP POLICY IF EXISTS "Teachers can upload papers" ON storage.objects;
DROP POLICY IF EXISTS "Teachers can view own papers" ON storage.objects;
DROP POLICY IF EXISTS "Teachers can update own papers" ON storage.objects;

-- 2. Drop teacher-insert policy that bypasses subject assignment check
DROP POLICY IF EXISTS "Teachers can insert own papers" ON public.exam_papers;

-- 3. Restrict exam_cell SELECT on exam_papers to approved/locked only
DROP POLICY IF EXISTS "Exam cell can view approved papers" ON public.exam_papers;
CREATE POLICY "Exam cell can view approved papers"
ON public.exam_papers FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'exam_cell'::app_role)
  AND status = ANY (ARRAY['approved'::paper_status, 'locked'::paper_status])
);

-- Mirror restriction on storage policy
DROP POLICY IF EXISTS "Exam cell can view approved papers" ON storage.objects;
CREATE POLICY "Exam cell can view approved papers"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'exam-papers'
  AND has_role(auth.uid(), 'exam_cell'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.exam_papers ep
    WHERE ep.file_path = storage.objects.name
      AND ep.status = ANY (ARRAY['approved'::paper_status, 'locked'::paper_status])
  )
);

-- 4. Restrict system_settings SELECT to privileged roles
DROP POLICY IF EXISTS "Authenticated users can view system settings" ON public.system_settings;
CREATE POLICY "Privileged roles can view system settings"
ON public.system_settings FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'exam_cell'::app_role)
  OR has_role(auth.uid(), 'hod'::app_role)
);

-- 5. Fix exam_cell_respond_to_review to use auth.uid() instead of caller-supplied _user_id
DROP FUNCTION IF EXISTS public.exam_cell_respond_to_review(uuid, uuid, text, text);

CREATE OR REPLACE FUNCTION public.exam_cell_respond_to_review(
  _paper_id uuid,
  _action text,
  _feedback text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _caller uuid := auth.uid();
  _current_status paper_status;
BEGIN
  IF _caller IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF NOT has_role(_caller, 'exam_cell'::app_role) THEN
    RAISE EXCEPTION 'Unauthorized: exam_cell role required';
  END IF;

  SELECT status INTO _current_status FROM public.exam_papers WHERE id = _paper_id;

  IF _current_status IS NULL THEN
    RAISE EXCEPTION 'Paper not found';
  END IF;

  IF _current_status <> 'review_requested' THEN
    RAISE EXCEPTION 'Paper is not in review_requested status (current: %)', _current_status;
  END IF;

  IF _action = 'approve' THEN
    UPDATE public.exam_papers
    SET status = 'locked', updated_at = now()
    WHERE id = _paper_id;
  ELSIF _action = 'feedback' THEN
    IF _feedback IS NULL OR TRIM(_feedback) = '' THEN
      RAISE EXCEPTION 'Feedback text is required';
    END IF;
    UPDATE public.exam_papers
    SET status = 'pending_review', feedback = TRIM(_feedback), updated_at = now()
    WHERE id = _paper_id;
  ELSE
    RAISE EXCEPTION 'Invalid action: %. Must be "approve" or "feedback"', _action;
  END IF;
END;
$function$;
