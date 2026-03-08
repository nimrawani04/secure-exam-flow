
-- Create a SECURITY DEFINER function to handle exam cell review responses
-- This bypasses RLS issues with the complex policy interactions on exam_papers
CREATE OR REPLACE FUNCTION public.exam_cell_respond_to_review(
  _paper_id uuid,
  _user_id uuid,
  _action text, -- 'approve' or 'feedback'
  _feedback text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _current_status paper_status;
  _is_exam_cell boolean;
BEGIN
  -- Verify the user has exam_cell role
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'exam_cell'
  ) INTO _is_exam_cell;
  
  IF NOT _is_exam_cell THEN
    RAISE EXCEPTION 'Unauthorized: user does not have exam_cell role';
  END IF;

  -- Verify the paper exists and is in review_requested status
  SELECT status INTO _current_status
  FROM public.exam_papers
  WHERE id = _paper_id;

  IF _current_status IS NULL THEN
    RAISE EXCEPTION 'Paper not found';
  END IF;

  IF _current_status != 'review_requested' THEN
    RAISE EXCEPTION 'Paper is not in review_requested status (current: %)', _current_status;
  END IF;

  IF _action = 'approve' THEN
    UPDATE public.exam_papers
    SET status = 'locked',
        updated_at = now()
    WHERE id = _paper_id;
  ELSIF _action = 'feedback' THEN
    IF _feedback IS NULL OR TRIM(_feedback) = '' THEN
      RAISE EXCEPTION 'Feedback text is required';
    END IF;
    UPDATE public.exam_papers
    SET status = 'pending_review',
        feedback = TRIM(_feedback),
        updated_at = now()
    WHERE id = _paper_id;
  ELSE
    RAISE EXCEPTION 'Invalid action: %. Must be "approve" or "feedback"', _action;
  END IF;
END;
$$;
