ALTER TABLE public.cuk_pages ADD COLUMN IF NOT EXISTS content_hash text;
CREATE INDEX IF NOT EXISTS cuk_pages_content_hash_idx ON public.cuk_pages (content_hash);