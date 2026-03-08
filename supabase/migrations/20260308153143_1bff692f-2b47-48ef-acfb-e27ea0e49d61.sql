
-- Per-user read tracking for notifications
CREATE TABLE public.notification_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  read_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (notification_id, user_id)
);

ALTER TABLE public.notification_reads ENABLE ROW LEVEL SECURITY;

-- Users can see their own reads
CREATE POLICY "Users can view own reads"
  ON public.notification_reads
  FOR SELECT
  USING (user_id = auth.uid());

-- Users can insert their own reads
CREATE POLICY "Users can insert own reads"
  ON public.notification_reads
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can delete their own reads (for mark unread)
CREATE POLICY "Users can delete own reads"
  ON public.notification_reads
  FOR DELETE
  USING (user_id = auth.uid());
