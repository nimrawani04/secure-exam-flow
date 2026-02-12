-- Allow exam cell to manage exam sessions and add exam date column

ALTER TABLE public.exam_sessions
  ADD COLUMN IF NOT EXISTS exam_date TIMESTAMPTZ;

ALTER TABLE public.exam_sessions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'exam_sessions'
      AND policyname = 'Exam cell can manage exam sessions'
  ) THEN
    CREATE POLICY "Exam cell can manage exam sessions"
      ON public.exam_sessions
      FOR ALL
      TO authenticated
      USING (public.has_role(auth.uid(), 'exam_cell'))
      WITH CHECK (
        public.has_role(auth.uid(), 'exam_cell')
        AND created_by = auth.uid()
      );
  END IF;
END $$;
