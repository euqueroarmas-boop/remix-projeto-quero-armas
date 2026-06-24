
ALTER TABLE public.qa_clientes
  ADD COLUMN IF NOT EXISTS campo_origens jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.qa_documentos_cliente
  ADD COLUMN IF NOT EXISTS prefill_consumed_at timestamptz;

CREATE INDEX IF NOT EXISTS qa_documentos_cliente_prefill_pendente_idx
  ON public.qa_documentos_cliente (qa_cliente_id)
  WHERE prefill_consumed_at IS NULL AND ia_dados_extraidos IS NOT NULL;
