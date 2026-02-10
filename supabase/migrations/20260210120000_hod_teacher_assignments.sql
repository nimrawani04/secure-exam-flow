-- Allow HODs to view roles for users in their department
CREATE POLICY "HOD can view department roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'hod') AND
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = user_roles.user_id
      AND p.department_id = public.get_user_department(auth.uid())
    )
  );

-- Allow HODs to manage teacher subject assignments for their department
CREATE POLICY "HOD can insert department teacher assignments"
  ON public.teacher_subjects FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'hod') AND
    EXISTS (
      SELECT 1 FROM public.subjects s
      WHERE s.id = subject_id
      AND s.department_id = public.get_user_department(auth.uid())
    ) AND
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = teacher_id
      AND p.department_id = public.get_user_department(auth.uid())
    )
  );

CREATE POLICY "HOD can delete department teacher assignments"
  ON public.teacher_subjects FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'hod') AND
    EXISTS (
      SELECT 1 FROM public.subjects s
      WHERE s.id = subject_id
      AND s.department_id = public.get_user_department(auth.uid())
    ) AND
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = teacher_id
      AND p.department_id = public.get_user_department(auth.uid())
    )
  );

CREATE POLICY "HOD can update department teacher assignments"
  ON public.teacher_subjects FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'hod') AND
    EXISTS (
      SELECT 1 FROM public.subjects s
      WHERE s.id = subject_id
      AND s.department_id = public.get_user_department(auth.uid())
    ) AND
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = teacher_id
      AND p.department_id = public.get_user_department(auth.uid())
    )
  );
