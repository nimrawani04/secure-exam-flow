-- Allow authenticated users to view active exam sessions for deadlines.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'exam_sessions'
      AND policyname = 'Authenticated can view active exam sessions'
  ) THEN
    CREATE POLICY "Authenticated can view active exam sessions"
      ON public.exam_sessions
      FOR SELECT
      TO authenticated
      USING (COALESCE(is_active, true));
  END IF;
END $$;
