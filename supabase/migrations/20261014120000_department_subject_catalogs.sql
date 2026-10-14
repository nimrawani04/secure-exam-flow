-- Migration to create department_subject_catalogs table
CREATE TABLE IF NOT EXISTS public.department_subject_catalogs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_label TEXT NOT NULL,
  school TEXT NOT NULL,
  session_label TEXT NOT NULL,
  programme TEXT NOT NULL,
  semester TEXT NOT NULL,
  batch TEXT NOT NULL,
  courses JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dept_subject_catalogs_lookup 
ON public.department_subject_catalogs(session_label, programme, semester, batch);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.department_subject_catalogs TO authenticated;
GRANT ALL ON public.department_subject_catalogs TO service_role;
