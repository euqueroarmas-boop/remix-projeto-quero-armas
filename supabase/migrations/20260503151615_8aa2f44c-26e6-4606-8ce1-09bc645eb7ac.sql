
ALTER TABLE public.qa_kb_artigos
  ADD COLUMN IF NOT EXISTS embedding_status TEXT NOT NULL DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS embedding_error TEXT,
  ADD COLUMN IF NOT EXISTS embedding_updated_at TIMESTAMPTZ;

UPDATE public.qa_kb_artigos
SET embedding_status = 'gerado', embedding_updated_at = now()
WHERE embedding IS NOT NULL AND embedding_status = 'pendente';

CREATE TABLE IF NOT EXISTS public.qa_kb_embeddings_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES public.qa_kb_artigos(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('sucesso','erro')),
  error_message TEXT,
  modelo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qa_kb_embeddings_log_article ON public.qa_kb_embeddings_log(article_id, created_at DESC);

ALTER TABLE public.qa_kb_embeddings_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS qa_kb_log_admin_select ON public.qa_kb_embeddings_log;
CREATE POLICY qa_kb_log_admin_select ON public.qa_kb_embeddings_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::lp_app_role));

CREATE OR REPLACE FUNCTION public.qa_kb_mark_embedding_pending()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.embedding_status := 'pendente';
    NEW.embedding := NULL;
    NEW.embedding_error := NULL;
    RETURN NEW;
  END IF;
  IF NEW.title IS DISTINCT FROM OLD.title
     OR NEW.body IS DISTINCT FROM OLD.body
     OR NEW.category IS DISTINCT FROM OLD.category
     OR NEW.module IS DISTINCT FROM OLD.module
     OR NEW.tags IS DISTINCT FROM OLD.tags
     OR NEW.symptoms IS DISTINCT FROM OLD.symptoms
  THEN
    NEW.embedding := NULL;
    NEW.embedding_status := 'pendente';
    NEW.embedding_error := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_qa_kb_mark_embedding_pending ON public.qa_kb_artigos;
CREATE TRIGGER trg_qa_kb_mark_embedding_pending
BEFORE INSERT OR UPDATE ON public.qa_kb_artigos
FOR EACH ROW EXECUTE FUNCTION public.qa_kb_mark_embedding_pending();
