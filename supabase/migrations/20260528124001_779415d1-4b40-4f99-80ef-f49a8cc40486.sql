ALTER TABLE public.qa_processo_documentos
  ADD COLUMN IF NOT EXISTS arma_id text NULL;

CREATE INDEX IF NOT EXISTS idx_qa_processo_documentos_arma_id
  ON public.qa_processo_documentos(arma_id)
  WHERE arma_id IS NOT NULL;

COMMENT ON COLUMN public.qa_processo_documentos.arma_id IS
  'Bloco 10: quando preenchido, vincula o documento a uma arma específica (qa_cliente_armas.arma_uid). NULL = documento genérico do processo.';