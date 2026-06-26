CREATE OR REPLACE FUNCTION public.search_cuk_pages(_query text, _limit integer DEFAULT 8)
RETURNS TABLE(id uuid, url text, title text, snippet text, is_pdf boolean, rank real)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH cleaned AS (
    SELECT
      trim(coalesce(_query, '')) AS raw_query,
      regexp_replace(lower(coalesce(_query, '')), '[^a-z0-9]+', ' ', 'g') AS norm_query,
      greatest(1, least(coalesce(_limit, 8), 25)) AS lim
  ), expanded AS (
    SELECT
      raw_query,
      trim(concat_ws(' ',
        raw_query,
        CASE WHEN norm_query ~ '\mbtech\M|\mb tech\M|\mbachelor.*technology\M' THEN 'b.tech b tech bachelor technology engineering computer science cse' ELSE '' END,
        CASE WHEN norm_query ~ '\mcse\M|\mcomputer science\M' THEN 'computer science engineering cse computers' ELSE '' END,
        CASE WHEN norm_query ~ '\msyl|\msyllabus\M|\mcurriculum\M|\mscheme\M' THEN 'syllabus curriculum scheme course courses paper semester' ELSE '' END,
        CASE WHEN norm_query ~ '\m6th\M|\msixth\M|\mvi\M' THEN 'sixth 6 vi semester' ELSE '' END,
        CASE WHEN norm_query ~ '\mnotice\M|\mnotification\M' THEN 'notice notification circular' ELSE '' END,
        CASE WHEN norm_query ~ '\mdate ?sheet\M|\mdatesheet\M' THEN 'date sheet datesheet examination exam' ELSE '' END
      )) AS expanded_query,
      lim
    FROM cleaned
  ), q AS (
    SELECT
      websearch_to_tsquery('english', expanded_query) AS tsq,
      regexp_split_to_array(
        regexp_replace(lower(expanded_query), '[^a-z0-9]+', ' ', 'g'),
        '\s+'
      ) AS terms,
      lim
    FROM expanded
  ), scored AS (
    SELECT
      p.id,
      p.url,
      p.title,
      ts_headline(
        'english',
        left(p.content, 4000),
        q.tsq,
        'MaxFragments=2, MinWords=10, MaxWords=45, ShortWord=3, HighlightAll=false'
      ) AS snippet,
      p.is_pdf,
      (
        CASE WHEN p.search_vector @@ q.tsq THEN ts_rank(p.search_vector, q.tsq) * 10 ELSE 0 END
        + CASE WHEN p.is_pdf THEN 0.35 ELSE 0 END
        + COALESCE((
          SELECT count(*)::real * 0.08
          FROM unnest(q.terms) term
          WHERE length(term) >= 3
            AND regexp_replace(lower(coalesce(p.title, '') || ' ' || coalesce(p.content, '') || ' ' || p.url), '[^a-z0-9]+', ' ', 'g') LIKE '%' || term || '%'
        ), 0)
        + CASE WHEN regexp_replace(lower(coalesce(p.title, '') || ' ' || p.url), '[^a-z0-9]+', ' ', 'g') LIKE '%pdf%' THEN 0.05 ELSE 0 END
      )::real AS rank
    FROM public.cuk_pages p
    CROSS JOIN q
    WHERE p.removed_at IS NULL
      AND (
        p.search_vector @@ q.tsq
        OR EXISTS (
          SELECT 1
          FROM unnest(q.terms) term
          WHERE length(term) >= 4
            AND regexp_replace(lower(coalesce(p.title, '') || ' ' || coalesce(p.content, '') || ' ' || p.url), '[^a-z0-9]+', ' ', 'g') LIKE '%' || term || '%'
        )
      )
  )
  SELECT id, url, title, snippet, is_pdf, rank
  FROM scored, q
  WHERE rank > 0
  ORDER BY rank DESC, is_pdf DESC, title ASC
  LIMIT (SELECT lim FROM q);
$function$;

REVOKE ALL ON FUNCTION public.search_cuk_pages(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_cuk_pages(text, integer) TO authenticated, service_role;