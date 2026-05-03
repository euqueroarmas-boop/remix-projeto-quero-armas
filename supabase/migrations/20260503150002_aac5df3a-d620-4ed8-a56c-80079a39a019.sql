
ALTER TABLE public.qa_kb_artigos ALTER COLUMN embedding TYPE vector(1536);

DROP INDEX IF EXISTS idx_qa_kb_artigos_embedding;
CREATE INDEX idx_qa_kb_artigos_embedding
  ON public.qa_kb_artigos USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50);

CREATE OR REPLACE FUNCTION public.qa_kb_search_hybrid(
  _query TEXT,
  _qemb vector(1536) DEFAULT NULL,
  _audience TEXT DEFAULT NULL,
  _limit INT DEFAULT 8
)
RETURNS TABLE(
  id UUID, title TEXT, slug TEXT, category TEXT, module TEXT,
  audience TEXT, tags TEXT[], symptoms TEXT[], body TEXT, rank REAL
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH q AS (
    SELECT
      plainto_tsquery('portuguese', coalesce(_query, '')) AS tsq,
      lower(coalesce(_query, '')) AS qlow
  )
  SELECT
    a.id, a.title, a.slug, a.category, a.module,
    a.audience, a.tags, a.symptoms, a.body,
    (
      coalesce(ts_rank(a.search_tsv, q.tsq), 0) * 4.0
      + CASE WHEN lower(a.title) LIKE '%'||q.qlow||'%' THEN 1.5 ELSE 0 END
      + CASE WHEN EXISTS (
          SELECT 1 FROM unnest(a.symptoms) s WHERE lower(s) LIKE '%'||q.qlow||'%'
        ) THEN 1.2 ELSE 0 END
      + CASE WHEN EXISTS (
          SELECT 1 FROM unnest(a.tags) t WHERE lower(t) LIKE '%'||q.qlow||'%'
        ) THEN 0.8 ELSE 0 END
      + CASE
          WHEN _qemb IS NOT NULL AND a.embedding IS NOT NULL
          THEN (1 - (a.embedding <=> _qemb)) * 3.0
          ELSE 0
        END
    )::real AS rank
  FROM public.qa_kb_artigos a, q
  WHERE a.status = 'published'
    AND (_audience IS NULL OR a.audience = _audience)
    AND (
      a.search_tsv @@ q.tsq
      OR lower(a.title) LIKE '%'||q.qlow||'%'
      OR EXISTS (SELECT 1 FROM unnest(a.symptoms) s WHERE lower(s) LIKE '%'||q.qlow||'%')
      OR EXISTS (SELECT 1 FROM unnest(a.tags) t WHERE lower(t) LIKE '%'||q.qlow||'%')
      OR (_qemb IS NOT NULL AND a.embedding IS NOT NULL AND (a.embedding <=> _qemb) < 0.6)
    )
  ORDER BY rank DESC
  LIMIT _limit;
$$;

GRANT EXECUTE ON FUNCTION public.qa_kb_search_hybrid(TEXT, vector, TEXT, INT) TO authenticated, anon, service_role;
