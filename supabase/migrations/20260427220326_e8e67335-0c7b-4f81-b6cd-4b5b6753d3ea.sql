-- Fase 2: colunas de validação IA em qa_processo_documentos
ALTER TABLE public.qa_processo_documentos
  ADD COLUMN IF NOT EXISTS validacao_ia_status     text,
  ADD COLUMN IF NOT EXISTS validacao_ia_erro       text,
  ADD COLUMN IF NOT EXISTS validacao_ia_confianca  numeric(3,2),
  ADD COLUMN IF NOT EXISTS validacao_ia_modelo     text;

CREATE INDEX IF NOT EXISTS idx_qa_processo_doc_ia_status
  ON public.qa_processo_documentos(validacao_ia_status)
  WHERE validacao_ia_status IS NOT NULL;