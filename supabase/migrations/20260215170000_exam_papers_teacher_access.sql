-- Allow paper owners to read and insert their own papers even if role metadata is missing.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'exam_papers'
      AND policyname = 'Users can view own papers'
  ) THEN
    CREATE POLICY "Users can view own papers"
      ON public.exam_papers
      FOR SELECT
      TO authenticated
      USING (uploaded_by = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'exam_papers'
      AND policyname = 'Teachers can insert assigned subject papers'
  ) THEN
    CREATE POLICY "Teachers can insert assigned subject papers"
      ON public.exam_papers
      FOR INSERT
      TO authenticated
      WITH CHECK (
        uploaded_by = auth.uid()
        AND EXISTS (
          SELECT 1
          FROM public.teacher_subjects ts
          WHERE ts.teacher_id = auth.uid()
            AND ts.subject_id = subject_id
        )
      );
  END IF;
END $$;
