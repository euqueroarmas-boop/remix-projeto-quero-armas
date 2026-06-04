
CREATE TABLE IF NOT EXISTS public.qa_kb_artigos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  module TEXT,
  audience TEXT NOT NULL DEFAULT 'equipe' CHECK (audience IN ('equipe','cliente')),
  tags TEXT[] NOT NULL DEFAULT '{}',
  symptoms TEXT[] NOT NULL DEFAULT '{}',
  body TEXT NOT NULL DEFAULT '',
  related_articles UUID[] NOT NULL DEFAULT '{}',
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft','published','archived')),
  author_id UUID,
  embedding vector(1536),
  search_tsv tsvector,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qa_kb_artigos_tsv ON public.qa_kb_artigos USING GIN (search_tsv);
CREATE INDEX IF NOT EXISTS idx_qa_kb_artigos_category ON public.qa_kb_artigos (category);
CREATE INDEX IF NOT EXISTS idx_qa_kb_artigos_status ON public.qa_kb_artigos (status);
CREATE INDEX IF NOT EXISTS idx_qa_kb_artigos_tags ON public.qa_kb_artigos USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_qa_kb_artigos_symptoms ON public.qa_kb_artigos USING GIN (symptoms);

CREATE OR REPLACE FUNCTION public.qa_kb_artigos_tsv_update()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  NEW.search_tsv :=
    setweight(to_tsvector('portuguese', coalesce(NEW.title,'')), 'A') ||
    setweight(to_tsvector('portuguese', coalesce(array_to_string(NEW.symptoms,' '),'')), 'A') ||
    setweight(to_tsvector('portuguese', coalesce(array_to_string(NEW.tags,' '),'')), 'B') ||
    setweight(to_tsvector('portuguese', coalesce(NEW.category,'') || ' ' || coalesce(NEW.module,'')), 'B') ||
    setweight(to_tsvector('portuguese', coalesce(NEW.body,'')), 'C');
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_qa_kb_artigos_tsv ON public.qa_kb_artigos;
CREATE TRIGGER trg_qa_kb_artigos_tsv
  BEFORE INSERT OR UPDATE ON public.qa_kb_artigos
  FOR EACH ROW EXECUTE FUNCTION public.qa_kb_artigos_tsv_update();

ALTER TABLE public.qa_kb_artigos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kb_equipe_select" ON public.qa_kb_artigos;
CREATE POLICY "kb_equipe_select" ON public.qa_kb_artigos
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::lp_app_role));

DROP POLICY IF EXISTS "kb_equipe_insert" ON public.qa_kb_artigos;
CREATE POLICY "kb_equipe_insert" ON public.qa_kb_artigos
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::lp_app_role));

DROP POLICY IF EXISTS "kb_equipe_update" ON public.qa_kb_artigos;
CREATE POLICY "kb_equipe_update" ON public.qa_kb_artigos
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::lp_app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::lp_app_role));

DROP POLICY IF EXISTS "kb_equipe_delete" ON public.qa_kb_artigos;
CREATE POLICY "kb_equipe_delete" ON public.qa_kb_artigos
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::lp_app_role));

CREATE OR REPLACE FUNCTION public.qa_kb_search_text(_query TEXT, _limit INT DEFAULT 8)
RETURNS TABLE(
  id UUID, title TEXT, slug TEXT, category TEXT, module TEXT,
  tags TEXT[], symptoms TEXT[], body TEXT, rank REAL
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH q AS (
    SELECT plainto_tsquery('portuguese', coalesce(_query,'')) AS tsq,
           lower(coalesce(_query,'')) AS qlow
  )
  SELECT a.id, a.title, a.slug, a.category, a.module, a.tags, a.symptoms, a.body,
    (
      ts_rank(a.search_tsv, q.tsq) * 4.0
      + CASE WHEN EXISTS (SELECT 1 FROM unnest(a.symptoms) s WHERE q.qlow LIKE '%'||lower(s)||'%' OR lower(s) LIKE '%'||q.qlow||'%') THEN 2.0 ELSE 0 END
      + CASE WHEN lower(a.title) LIKE '%'||q.qlow||'%' THEN 1.5 ELSE 0 END
    )::real AS rank
  FROM public.qa_kb_artigos a, q
  WHERE a.status = 'published'
    AND (
      a.search_tsv @@ q.tsq
      OR lower(a.title) LIKE '%'||q.qlow||'%'
      OR EXISTS (SELECT 1 FROM unnest(a.symptoms) s WHERE q.qlow LIKE '%'||lower(s)||'%' OR lower(s) LIKE '%'||q.qlow||'%')
      OR EXISTS (SELECT 1 FROM unnest(a.tags) t WHERE lower(t) = q.qlow)
    )
  ORDER BY rank DESC
  LIMIT _limit;
$$;

GRANT EXECUTE ON FUNCTION public.qa_kb_search_text(TEXT, INT) TO authenticated;
