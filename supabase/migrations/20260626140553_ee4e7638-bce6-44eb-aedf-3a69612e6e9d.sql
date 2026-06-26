
ALTER TABLE public.cuk_pages
  ADD COLUMN IF NOT EXISTS removed_at timestamptz,
  ADD COLUMN IF NOT EXISTS first_missing_at timestamptz;

CREATE INDEX IF NOT EXISTS cuk_pages_removed_at_idx ON public.cuk_pages (removed_at);

-- Exclude removed rows from search results
CREATE OR REPLACE FUNCTION public.search_cuk_pages(_query text, _limit integer DEFAULT 8)
 RETURNS TABLE(id uuid, url text, title text, snippet text, is_pdf boolean, rank real)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    AND p.removed_at IS NULL
  ORDER BY rank DESC, p.is_pdf DESC, p.last_crawled_at DESC
  LIMIT greatest(1, least(coalesce(_limit, 8), 25));
$function$;
