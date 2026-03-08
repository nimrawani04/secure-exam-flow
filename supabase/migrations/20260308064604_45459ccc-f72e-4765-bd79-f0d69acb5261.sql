
CREATE TABLE public.teacher_calendar_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  exam_type TEXT,
  exam_date TIMESTAMPTZ,
  submission_deadline TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'submitted')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.teacher_calendar_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can view own calendar entries"
  ON public.teacher_calendar_entries FOR SELECT
  USING (teacher_id = auth.uid());

CREATE POLICY "Teachers can insert own calendar entries"
  ON public.teacher_calendar_entries FOR INSERT
  WITH CHECK (teacher_id = auth.uid() AND has_role(auth.uid(), 'teacher'::app_role));

CREATE POLICY "Teachers can update own calendar entries"
  ON public.teacher_calendar_entries FOR UPDATE
  USING (teacher_id = auth.uid() AND has_role(auth.uid(), 'teacher'::app_role));

CREATE POLICY "Teachers can delete own calendar entries"
  ON public.teacher_calendar_entries FOR DELETE
  USING (teacher_id = auth.uid() AND has_role(auth.uid(), 'teacher'::app_role));

ALTER PUBLICATION supabase_realtime ADD TABLE public.teacher_calendar_entries;
