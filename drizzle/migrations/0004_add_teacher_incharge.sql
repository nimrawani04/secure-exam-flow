-- Migration to add teacher_incharge_name to examiner_panels
ALTER TABLE public.examiner_panels
  ADD COLUMN IF NOT EXISTS teacher_incharge_name text;
