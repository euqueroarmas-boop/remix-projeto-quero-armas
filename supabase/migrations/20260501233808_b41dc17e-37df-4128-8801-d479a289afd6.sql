-- 1) Índice único parcial: 1 modelo por documento de origem
CREATE UNIQUE INDEX IF NOT EXISTS uq_qa_modelos_origem_doc_unico
  ON public.qa_documentos_modelos_aprovados(documento_origem_id)
  WHERE documento_origem_id IS NOT NULL;

-- 2) Configuração por tipo: campos auxiliares
ALTER TABLE public.qa_validacao_config
  ADD COLUMN IF NOT EXISTS campos_obrigatorios_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS palavras_chave_esperadas_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true;

-- 3) Índices auxiliares para o Monitor
CREATE INDEX IF NOT EXISTS idx_qa_proc_docs_status_updated
  ON public.qa_processo_documentos(status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_qa_proc_docs_validacao_status
  ON public.qa_processo_documentos(validacao_ia_status);