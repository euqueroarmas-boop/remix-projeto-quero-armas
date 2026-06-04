ALTER TABLE public.qa_kb_artigos
  ADD COLUMN IF NOT EXISTS audit_status text NOT NULL DEFAULT 'pending_audit',
  ADD COLUMN IF NOT EXISTS audit_session_id uuid REFERENCES public.qa_kb_audit_sessions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS checklist_audited_at timestamptz,
  ADD COLUMN IF NOT EXISTS knowledge_base_audited_at timestamptz,
  ADD COLUMN IF NOT EXISTS procedure_tested_at timestamptz,
  ADD COLUMN IF NOT EXISTS audit_ready_at timestamptz;

ALTER TABLE public.qa_kb_artigos
  DROP CONSTRAINT IF EXISTS qa_kb_artigos_audit_status_check;
ALTER TABLE public.qa_kb_artigos
  ADD CONSTRAINT qa_kb_artigos_audit_status_check
  CHECK (audit_status IN ('pending_audit','checklist_audited','kb_audited','procedure_tested','ready_to_write','completed','rejected'));

ALTER TABLE public.qa_kb_artigos
  DROP CONSTRAINT IF EXISTS qa_kb_artigos_status_check;
ALTER TABLE public.qa_kb_artigos
  ADD CONSTRAINT qa_kb_artigos_status_check
  CHECK (status = ANY (ARRAY['draft','audit_pending','needs_review','needs_real_image','audited','published','rejected','archived']));

CREATE INDEX IF NOT EXISTS idx_qa_kb_artigos_audit_status ON public.qa_kb_artigos(audit_status);
CREATE INDEX IF NOT EXISTS idx_qa_kb_artigos_audit_session ON public.qa_kb_artigos(audit_session_id);

CREATE OR REPLACE FUNCTION public.qa_kb_article_has_approved_real_image(_article_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.qa_kb_artigo_imagens img
     WHERE img.article_id = _article_id
       AND img.status = 'approved'
       AND img.image_type IN ('screenshot_real','upload_manual','documento_real','auditoria_real')
       AND COALESCE(img.is_ai_generated_blocked, false) = false
       AND COALESCE(img.original_image_type, img.image_type) <> 'imagem_ia'
  );
$$;

CREATE OR REPLACE FUNCTION public.qa_kb_article_audit_complete(
  _audit_status text,
  _checklist_audited_at timestamptz,
  _knowledge_base_audited_at timestamptz,
  _procedure_tested_at timestamptz,
  _audit_ready_at timestamptz
)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT _audit_status IN ('ready_to_write','completed')
     AND _checklist_audited_at IS NOT NULL
     AND _knowledge_base_audited_at IS NOT NULL
     AND _procedure_tested_at IS NOT NULL
     AND _audit_ready_at IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public.qa_kb_enforce_article_publish_gate()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('audited','published') THEN
    IF NOT public.qa_kb_article_audit_complete(
      NEW.audit_status,
      NEW.checklist_audited_at,
      NEW.knowledge_base_audited_at,
      NEW.procedure_tested_at,
      NEW.audit_ready_at
    ) THEN
      RAISE EXCEPTION 'BLOQUEADO: audite checklist, base de conhecimento e procedimento testado antes de aprovar/publicar o artigo.';
    END IF;

    IF NOT public.qa_kb_article_has_approved_real_image(NEW.id) THEN
      RAISE EXCEPTION 'BLOQUEADO: este artigo ainda não possui imagem real auditável aprovada.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_qa_kb_enforce_article_publish_gate ON public.qa_kb_artigos;
CREATE TRIGGER trg_qa_kb_enforce_article_publish_gate
  BEFORE INSERT OR UPDATE ON public.qa_kb_artigos
  FOR EACH ROW EXECUTE FUNCTION public.qa_kb_enforce_article_publish_gate();

-- Artigos ainda sem evidência real aprovada ficam explicitamente fora da publicação.
UPDATE public.qa_kb_artigos a
   SET status = CASE WHEN status IN ('published','audited') THEN 'needs_real_image' ELSE status END,
       audit_status = CASE WHEN audit_status = 'completed' THEN audit_status ELSE 'pending_audit' END,
       approved_at = NULL,
       approved_by = NULL
 WHERE status IN ('published','audited')
   AND NOT public.qa_kb_article_has_approved_real_image(a.id);

-- Artigos com imagem real mas sem auditoria completa voltam para revisão antes de publicação.
UPDATE public.qa_kb_artigos a
   SET status = CASE WHEN status IN ('published','audited') THEN 'audit_pending' ELSE status END,
       audit_status = CASE WHEN audit_status = 'completed' THEN audit_status ELSE 'pending_audit' END,
       approved_at = NULL,
       approved_by = NULL
 WHERE status IN ('published','audited')
   AND public.qa_kb_article_has_approved_real_image(a.id)
   AND NOT public.qa_kb_article_audit_complete(
     a.audit_status,
     a.checklist_audited_at,
     a.knowledge_base_audited_at,
     a.procedure_tested_at,
     a.audit_ready_at
   );

CREATE OR REPLACE FUNCTION public.qa_kb_search_hybrid(
  _query text,
  _qemb vector DEFAULT NULL,
  _audience text DEFAULT NULL,
  _limit integer DEFAULT 8
)
RETURNS TABLE (
  id uuid,
  title text,
  slug text,
  category text,
  module text,
  audience text,
  tags text[],
  symptoms text[],
  body text,
  rank real
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT a.*,
      ts_rank_cd(a.search_tsv, plainto_tsquery('portuguese', coalesce(_query,''))) AS text_rank,
      CASE WHEN _qemb IS NOT NULL AND a.embedding IS NOT NULL THEN (1 - (a.embedding <=> _qemb)) ELSE 0 END AS vec_rank
    FROM public.qa_kb_artigos a
    WHERE a.status = 'published'
      AND (_audience IS NULL OR a.audience = _audience)
      AND public.qa_kb_article_audit_complete(
        a.audit_status,
        a.checklist_audited_at,
        a.knowledge_base_audited_at,
        a.procedure_tested_at,
        a.audit_ready_at
      )
      AND public.qa_kb_article_has_approved_real_image(a.id)
      AND (
        a.search_tsv @@ plainto_tsquery('portuguese', coalesce(_query,''))
        OR _qemb IS NOT NULL
        OR a.title ILIKE '%' || coalesce(_query,'') || '%'
        OR EXISTS (SELECT 1 FROM unnest(a.tags) t WHERE t ILIKE '%' || coalesce(_query,'') || '%')
        OR EXISTS (SELECT 1 FROM unnest(a.symptoms) s WHERE s ILIKE '%' || coalesce(_query,'') || '%')
      )
  )
  SELECT b.id, b.title, b.slug, b.category, b.module, b.audience, b.tags, b.symptoms, b.body,
         GREATEST(b.text_rank, b.vec_rank)::real AS rank
  FROM base b
  ORDER BY rank DESC, b.updated_at DESC
  LIMIT LEAST(GREATEST(COALESCE(_limit, 8), 1), 20);
$$;