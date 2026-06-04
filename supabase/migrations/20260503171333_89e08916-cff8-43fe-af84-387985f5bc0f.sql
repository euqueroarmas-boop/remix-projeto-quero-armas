
-- BLOQUEIO DEFINITIVO: imagens da base de conhecimento devem ser exclusivamente reais/auditáveis.

-- 1) Marcar todas imagens IA existentes como arquivadas (invalidadas)
UPDATE public.qa_kb_artigo_imagens
   SET status = 'archived'
 WHERE image_type = 'imagem_ia'
   AND status <> 'archived';

-- 2) Atualizar CHECK constraint do image_type: remover 'imagem_ia', adicionar tipos reais
ALTER TABLE public.qa_kb_artigo_imagens
  DROP CONSTRAINT IF EXISTS qa_kb_artigo_imagens_image_type_check;

-- Reclassifica registros antigos 'imagem_ia' para 'auditoria_real' (já arquivados acima)
-- para passar na nova constraint sem perder histórico
UPDATE public.qa_kb_artigo_imagens
   SET image_type = 'auditoria_real'
 WHERE image_type = 'imagem_ia';

ALTER TABLE public.qa_kb_artigo_imagens
  ADD CONSTRAINT qa_kb_artigo_imagens_image_type_check
  CHECK (image_type IN ('screenshot_real','upload_manual','documento_real','auditoria_real'));

ALTER TABLE public.qa_kb_artigo_imagens
  ALTER COLUMN image_type SET DEFAULT 'upload_manual';

-- 3) Auditoria: quem subiu, quando, origem
ALTER TABLE public.qa_kb_artigo_imagens
  ADD COLUMN IF NOT EXISTS uploaded_by uuid,
  ADD COLUMN IF NOT EXISTS uploaded_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS origem text;

-- 4) Trigger global: bloquear definitivamente qualquer tentativa de inserir imagem_ia
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
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_qa_kb_block_ia_images ON public.qa_kb_artigo_imagens;
CREATE TRIGGER trg_qa_kb_block_ia_images
  BEFORE INSERT OR UPDATE ON public.qa_kb_artigo_imagens
  FOR EACH ROW EXECUTE FUNCTION public.qa_kb_block_ia_images();

-- 5) RLS de leitura para clientes: só imagens aprovadas e de tipo real auditável (sem IA)
DROP POLICY IF EXISTS "kb_img_cliente_select" ON public.qa_kb_artigo_imagens;
CREATE POLICY "kb_img_cliente_select"
  ON public.qa_kb_artigo_imagens
  FOR SELECT
  TO authenticated
  USING (
    status = 'approved'
    AND image_type IN ('screenshot_real','upload_manual','documento_real','auditoria_real')
    AND EXISTS (
      SELECT 1 FROM qa_kb_artigos a
       WHERE a.id = qa_kb_artigo_imagens.article_id
         AND a.status = 'published'
         AND a.audience = 'cliente'
    )
  );
