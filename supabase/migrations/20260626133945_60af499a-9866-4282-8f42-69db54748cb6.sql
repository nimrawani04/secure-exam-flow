
-- Pages and PDFs crawled from cukashmir.ac.in
CREATE TABLE public.cuk_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url text NOT NULL UNIQUE,
  title text,
  content text NOT NULL DEFAULT '',
  is_pdf boolean NOT NULL DEFAULT false,
  http_status int,
  content_length int,
  last_crawled_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  search_vector tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(content, '')), 'B')
  ) STORED
);

CREATE INDEX cuk_pages_search_idx ON public.cuk_pages USING gin (search_vector);
CREATE INDEX cuk_pages_is_pdf_idx ON public.cuk_pages (is_pdf);
CREATE INDEX cuk_pages_last_crawled_idx ON public.cuk_pages (last_crawled_at);

GRANT SELECT ON public.cuk_pages TO authenticated;
GRANT ALL ON public.cuk_pages TO service_role;

ALTER TABLE public.cuk_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read cuk_pages"
ON public.cuk_pages FOR SELECT TO authenticated USING (true);

-- BFS frontier for the background crawler (resumable across edge-function runs)
CREATE TABLE public.crawl_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url text NOT NULL UNIQUE,
  depth int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending', -- pending | processing | done | failed
  attempts int NOT NULL DEFAULT 0,
  last_error text,
  enqueued_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE INDEX crawl_queue_status_idx ON public.crawl_queue (status, enqueued_at);

GRANT SELECT ON public.crawl_queue TO authenticated;
GRANT ALL  ON public.crawl_queue TO service_role;

ALTER TABLE public.crawl_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read crawl_queue"
ON public.crawl_queue FOR SELECT TO authenticated USING (true);

-- Search RPC used by the chatbot
CREATE OR REPLACE FUNCTION public.search_cuk_pages(_query text, _limit int DEFAULT 8)
RETURNS TABLE (
  id uuid,
  url text,
  title text,
  snippet text,
  is_pdf boolean,
  rank real
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH q AS (
    SELECT websearch_to_tsquery('english', coalesce(_query, '')) AS tsq
  )
  SELECT
    p.id,
    p.url,
    p.title,
    ts_headline(
      'english',
      left(p.content, 4000),
      q.tsq,
      'MaxFragments=2, MinWords=10, MaxWords=40, ShortWord=3, HighlightAll=false'
    ) AS snippet,
    p.is_pdf,
    ts_rank(p.search_vector, q.tsq) AS rank
  FROM public.cuk_pages p, q
  WHERE p.search_vector @@ q.tsq
  ORDER BY rank DESC, p.is_pdf DESC, p.last_crawled_at DESC
  LIMIT greatest(1, least(coalesce(_limit, 8), 25));
$$;

REVOKE ALL ON FUNCTION public.search_cuk_pages(text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_cuk_pages(text, int) TO authenticated, service_role;

-- Seed the crawler with the homepage and a few key indexes
INSERT INTO public.crawl_queue (url, depth) VALUES
  ('https://www.cukashmir.ac.in/', 0),
  ('https://www.cukashmir.ac.in/Default.aspx', 0),
  ('https://www.cukashmir.ac.in/cukashmir/Notices.aspx', 0),
  ('https://www.cukashmir.ac.in/cukashmir/Tenders.aspx', 0),
  ('https://www.cukashmir.ac.in/cukashmir/Recruitments.aspx', 0),
  ('https://www.cukashmir.ac.in/cukashmir/Admissions.aspx', 0),
  ('https://www.cukashmir.ac.in/cukashmir/Examination.aspx', 0),
  ('https://www.cukashmir.ac.in/cukashmir/Results.aspx', 0),
  ('https://www.cukashmir.ac.in/cukashmir/Departments.aspx', 0),
  ('https://www.cukashmir.ac.in/cukashmir/Schools.aspx', 0),
  ('https://www.cukashmir.ac.in/cukashmir/Downloads.aspx', 0)
ON CONFLICT (url) DO NOTHING;
