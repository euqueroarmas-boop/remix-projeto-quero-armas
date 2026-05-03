
-- 1) Novos campos de rastreabilidade
ALTER TABLE public.qa_kb_artigo_imagens
  ADD COLUMN IF NOT EXISTS original_image_type text,
  ADD COLUMN IF NOT EXISTS is_ai_generated_blocked boolean NOT NULL DEFAULT false;

-- 2) Permitir novo status 'archived_invalid_ai'
ALTER TABLE public.qa_kb_artigo_imagens
  DROP CONSTRAINT IF EXISTS qa_kb_artigo_imagens_status_check;
ALTER TABLE public.qa_kb_artigo_imagens
  ADD CONSTRAINT qa_kb_artigo_imagens_status_check
  CHECK (status IN ('draft','approved','archived','error','archived_invalid_ai'));

-- 3) Restaurar rastro: tudo que foi movido de imagem_ia -> auditoria_real ficou
--    com status='archived'. Reclassificamos esses registros como invalidados de IA.
UPDATE public.qa_kb_artigo_imagens
   SET original_image_type = 'imagem_ia',
       is_ai_generated_blocked = true,
       status = 'archived_invalid_ai'
 WHERE status = 'archived'
   AND image_type = 'auditoria_real'
   AND original_image_type IS NULL;

-- Para registros futuros válidos (reais), preencher original_image_type igual ao tipo real
UPDATE public.qa_kb_artigo_imagens
   SET original_image_type = image_type
 WHERE original_image_type IS NULL;

-- 4) Trigger global reforçado: além de bloquear image_type='imagem_ia',
--    bloqueia qualquer aprovação/exibição de registros marcados como IA bloqueada.
CREATE OR REPLACE FUNCTION public.qa_kb_block_ia_images()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.image_type = 'imagem_ia' THEN
    RAISE EXCEPTION 'BLOQUEADO: imagens geradas por IA não são permitidas. Use screenshot_real, upload_manual, documento_real ou auditoria_real.';
  END IF;
  IF NEW.original_image_type = 'imagem_ia' OR NEW.is_ai_generated_blocked = true THEN
    -- só permite mantê-la em estados arquivados/inválidos
    IF NEW.status NOT IN ('archived','archived_invalid_ai') THEN
      RAISE EXCEPTION 'BLOQUEADO: este registro tem origem em IA (original_image_type=imagem_ia ou is_ai_generated_blocked=true) e não pode ser ativado/aprovado.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_qa_kb_block_ia_images ON public.qa_kb_artigo_imagens;
CREATE TRIGGER trg_qa_kb_block_ia_images
  BEFORE INSERT OR UPDATE ON public.qa_kb_artigo_imagens
  FOR EACH ROW EXECUTE FUNCTION public.qa_kb_block_ia_images();

-- 5) RLS: cliente nunca vê imagens com origem IA, mesmo que reclassificadas
DROP POLICY IF EXISTS "kb_img_cliente_select" ON public.qa_kb_artigo_imagens;
CREATE POLICY "kb_img_cliente_select"
  ON public.qa_kb_artigo_imagens
  FOR SELECT
  TO authenticated
  USING (
    status = 'approved'
    AND image_type IN ('screenshot_real','upload_manual','documento_real','auditoria_real')
    AND COALESCE(is_ai_generated_blocked, false) = false
    AND COALESCE(original_image_type, image_type) <> 'imagem_ia'
    AND EXISTS (
      SELECT 1 FROM qa_kb_artigos a
       WHERE a.id = qa_kb_artigo_imagens.article_id
         AND a.status = 'published'
         AND a.audience = 'cliente'
    )
  );
