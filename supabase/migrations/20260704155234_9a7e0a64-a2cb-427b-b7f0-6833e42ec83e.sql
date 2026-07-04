-- 1.1 Backfill retroativo: documentos em auxiliares/ que escaparam
UPDATE public.qa_documentos_conhecimento
   SET papel_documento = 'auxiliar_caso',
       ativo_na_ia = false,
       updated_at = now()
 WHERE storage_path LIKE 'auxiliares/%'
   AND (papel_documento IS DISTINCT FROM 'auxiliar_caso' OR ativo_na_ia = true);

-- 2.1 Vínculo com fonte normativa e visibilidade
ALTER TABLE public.qa_documentos_conhecimento
  ADD COLUMN IF NOT EXISTS fonte_normativa_id uuid
    REFERENCES public.qa_fontes_normativas(id) ON DELETE SET NULL;

ALTER TABLE public.qa_documentos_conhecimento
  ADD COLUMN IF NOT EXISTS visivel_cliente boolean NOT NULL DEFAULT false;

ALTER TABLE public.qa_chunks_conhecimento
  ADD COLUMN IF NOT EXISTS fonte_normativa_id uuid
    REFERENCES public.qa_fontes_normativas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_chunks_fonte_normativa
  ON public.qa_chunks_conhecimento(fonte_normativa_id)
  WHERE fonte_normativa_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_docs_fonte_normativa
  ON public.qa_documentos_conhecimento(fonte_normativa_id)
  WHERE fonte_normativa_id IS NOT NULL;

-- 1.4 Limpeza de chunks órfãos de evidência de cliente
DELETE FROM public.qa_chunks_conhecimento c
 USING public.qa_documentos_conhecimento d
 WHERE c.documento_id = d.id
   AND (d.papel_documento = 'auxiliar_caso' OR d.ativo_na_ia = false);

-- Limpar embeddings órfãos (chunk já foi removido acima)
DELETE FROM public.qa_embeddings e
 WHERE NOT EXISTS (SELECT 1 FROM public.qa_chunks_conhecimento c WHERE c.id = e.chunk_id);