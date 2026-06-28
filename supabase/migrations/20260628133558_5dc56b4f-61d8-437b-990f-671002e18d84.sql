CREATE TABLE public.pdf_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  query TEXT NOT NULL,
  department TEXT,
  course TEXT,
  semester TEXT,
  document_type TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  correlation_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.pdf_requests TO authenticated;
GRANT ALL ON public.pdf_requests TO service_role;
ALTER TABLE public.pdf_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users insert own pdf requests" ON public.pdf_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users read own pdf requests" ON public.pdf_requests FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Exam cell reads all pdf requests" ON public.pdf_requests FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'exam_cell'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Exam cell updates pdf requests" ON public.pdf_requests FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'exam_cell'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE TRIGGER update_pdf_requests_updated_at BEFORE UPDATE ON public.pdf_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_pdf_requests_user ON public.pdf_requests(user_id, created_at DESC);
CREATE INDEX idx_pdf_requests_status ON public.pdf_requests(status, created_at DESC);