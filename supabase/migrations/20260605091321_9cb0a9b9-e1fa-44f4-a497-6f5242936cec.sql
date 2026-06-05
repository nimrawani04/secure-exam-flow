
-- Fix RLS policy bugs and lock down privilege escalation paths

-- 1. Fix self-join bug on exam_papers INSERT policy
DROP POLICY IF EXISTS "Teachers can insert assigned subject papers" ON public.exam_papers;
CREATE POLICY "Teachers can insert assigned subject papers"
ON public.exam_papers FOR INSERT TO authenticated
WITH CHECK (
  uploaded_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.teacher_subjects ts
    WHERE ts.teacher_id = auth.uid()
      AND ts.subject_id = exam_papers.subject_id
  )
);

-- 2. Fix self-join bug on exams SELECT policy for teachers
DROP POLICY IF EXISTS "Teachers can view own subject exams" ON public.exams;
CREATE POLICY "Teachers can view own subject exams"
ON public.exams FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'teacher'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.teacher_subjects ts
    WHERE ts.teacher_id = auth.uid()
      AND ts.subject_id = exams.subject_id
  )
);

-- 3. system_settings: restrict SELECT to authenticated users
DROP POLICY IF EXISTS "Authenticated users can view system settings" ON public.system_settings;
CREATE POLICY "Authenticated users can view system settings"
ON public.system_settings FOR SELECT TO authenticated
USING (true);

-- 4. user_roles: remove self-assignment INSERT policy (role assignment must go through trigger or admin function)
DROP POLICY IF EXISTS "Users can insert own role during signup" ON public.user_roles;

-- 5. Storage exam-papers: restrict HOD/exam_cell to department-scoped files via join to exam_papers
DROP POLICY IF EXISTS "HOD can view department exam papers" ON storage.objects;
CREATE POLICY "HOD can view department exam papers"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'exam-papers'
  AND has_role(auth.uid(), 'hod'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.exam_papers ep
    JOIN public.subjects s ON s.id = ep.subject_id
    WHERE ep.file_path = storage.objects.name
      AND s.department_id = get_user_department(auth.uid())
  )
);

DROP POLICY IF EXISTS "Exam cell can view approved papers" ON storage.objects;
CREATE POLICY "Exam cell can view approved papers"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'exam-papers'
  AND has_role(auth.uid(), 'exam_cell'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.exam_papers ep
    WHERE ep.file_path = storage.objects.name
      AND ep.status IN ('approved'::paper_status, 'locked'::paper_status, 'resubmission_requested'::paper_status, 'review_requested'::paper_status)
  )
);

DROP POLICY IF EXISTS "Exam cell can view approved papers at unlock time" ON storage.objects;
CREATE POLICY "Exam cell can view approved papers at unlock time"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'exam-papers'
  AND has_role(auth.uid(), 'exam_cell'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.exam_papers ep
    WHERE ep.file_path = storage.objects.name
      AND ep.status IN ('approved'::paper_status, 'locked'::paper_status)
  )
);

-- 6. Lock down select_paper_and_reject_others: enforce HOD role and ignore caller-supplied _hod_id
CREATE OR REPLACE FUNCTION public.select_paper_and_reject_others(_paper_id uuid, _subject_id uuid, _exam_type exam_type, _hod_id uuid, _remark text DEFAULT NULL::text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _caller uuid := auth.uid();
  _caller_dept uuid;
  _subject_dept uuid;
BEGIN
  IF _caller IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF NOT has_role(_caller, 'hod'::app_role) THEN
    RAISE EXCEPTION 'Unauthorized: HOD role required';
  END IF;

  SELECT department_id INTO _caller_dept FROM public.profiles WHERE id = _caller;
  SELECT department_id INTO _subject_dept FROM public.subjects WHERE id = _subject_id;

  IF _caller_dept IS NULL OR _subject_dept IS NULL OR _caller_dept <> _subject_dept THEN
    RAISE EXCEPTION 'Unauthorized: subject not in your department';
  END IF;

  UPDATE exam_papers
  SET is_selected = false
  WHERE subject_id = _subject_id
    AND exam_type = _exam_type;

  UPDATE exam_papers
  SET is_selected = true,
      status = 'locked',
      feedback = COALESCE(NULLIF(TRIM(_remark), ''), feedback),
      approved_by = _caller,
      approved_at = now()
  WHERE id = _paper_id
    AND subject_id = _subject_id;

  UPDATE exam_papers
  SET status = 'rejected',
      feedback = 'Another paper was selected for this exam'
  WHERE subject_id = _subject_id
    AND exam_type = _exam_type
    AND id != _paper_id
    AND status NOT IN ('locked', 'rejected', 'draft');
END;
$function$;

-- 7. handle_new_user: only allow self-assigning 'teacher' role via signup metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  meta_full_name TEXT;
  meta_department TEXT;
  meta_role TEXT;
  department_uuid UUID;
BEGIN
  meta_full_name := NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), '');
  meta_department := NULLIF(TRIM(NEW.raw_user_meta_data->>'department_id'), '');
  meta_role := NULLIF(TRIM(NEW.raw_user_meta_data->>'role'), '');

  IF meta_department ~* '^[0-9a-f-]{36}$' THEN
    department_uuid := meta_department::uuid;
  ELSE
    department_uuid := NULL;
  END IF;

  INSERT INTO public.profiles (id, full_name, email, department_id)
  VALUES (
    NEW.id,
    COALESCE(meta_full_name, split_part(NEW.email, '@', 1), 'User'),
    NEW.email,
    department_uuid
  )
  ON CONFLICT (id) DO NOTHING;

  -- Only the 'teacher' role can be auto-assigned via self-signup metadata.
  -- Privileged roles (hod, exam_cell, admin) must be assigned via the admin-users edge function.
  IF meta_role = 'teacher' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'teacher'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;
