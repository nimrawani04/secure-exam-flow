-- Migration to align examiner_panels with new Panel of Examiners Format Excel
ALTER TABLE public.examiner_panels
  ADD COLUMN IF NOT EXISTS batch text,
  ADD COLUMN IF NOT EXISTS credits text,
  ADD COLUMN IF NOT EXISTS course_nature text,
  ADD COLUMN IF NOT EXISTS regular_backlog text;
