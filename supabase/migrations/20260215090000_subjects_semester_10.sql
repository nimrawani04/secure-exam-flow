-- Allow programs with up to 10 semesters
ALTER TABLE public.subjects
  DROP CONSTRAINT IF EXISTS subjects_semester_check;

ALTER TABLE public.subjects
  ADD CONSTRAINT subjects_semester_check
  CHECK (semester >= 1 AND semester <= 10);
