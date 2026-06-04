ALTER TABLE public.qa_processo_documentos
  ADD COLUMN IF NOT EXISTS assinatura_status text,
  ADD COLUMN IF NOT EXISTS assinatura_signatario text,
  ADD COLUMN IF NOT EXISTS assinatura_cpf text,
  ADD COLUMN IF NOT EXISTS assinatura_data timestamptz,
  ADD COLUMN IF NOT EXISTS assinatura_autoridade text,
  ADD COLUMN IF NOT EXISTS assinatura_motivo_falha text,
  ADD COLUMN IF NOT EXISTS assinatura_validada_em timestamptz,
  ADD COLUMN IF NOT EXISTS assinatura_detalhes_json jsonb;

CREATE INDEX IF NOT EXISTS idx_qa_proc_docs_assinatura_status
  ON public.qa_processo_documentos (assinatura_status)
  WHERE assinatura_status IS NOT NULL;