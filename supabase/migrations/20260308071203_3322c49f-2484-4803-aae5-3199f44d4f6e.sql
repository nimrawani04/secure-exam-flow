
CREATE OR REPLACE FUNCTION public.select_paper_and_reject_others(
  _paper_id uuid,
  _subject_id uuid,
  _exam_type exam_type,
  _hod_id uuid,
  _remark text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Deselect any previously selected papers for this subject/exam type
  UPDATE exam_papers
  SET is_selected = false
  WHERE subject_id = _subject_id
    AND exam_type = _exam_type;

  -- Lock and select the chosen paper
  UPDATE exam_papers
  SET is_selected = true,
      status = 'locked',
      feedback = COALESCE(NULLIF(TRIM(_remark), ''), feedback),
      approved_by = _hod_id,
      approved_at = now()
  WHERE id = _paper_id;

  -- Reject ALL other non-locked papers for this subject/exam type
  UPDATE exam_papers
  SET status = 'rejected',
      feedback = 'Another paper was selected for this exam'
  WHERE subject_id = _subject_id
    AND exam_type = _exam_type
    AND id != _paper_id
    AND status NOT IN ('locked', 'rejected', 'draft');
END;
$$;
