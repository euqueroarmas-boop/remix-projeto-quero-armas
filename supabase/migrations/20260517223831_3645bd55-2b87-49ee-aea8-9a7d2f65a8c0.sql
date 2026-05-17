ALTER TABLE public.qa_documentos_cliente
  ADD COLUMN IF NOT EXISTS substitui_documento_id uuid NULL REFERENCES public.qa_documentos_cliente(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS versao integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS substituido_em timestamptz NULL,
  ADD COLUMN IF NOT EXISTS substituido_por_documento_id uuid NULL REFERENCES public.qa_documentos_cliente(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_qa_docs_substitui
  ON public.qa_documentos_cliente(substitui_documento_id)
  WHERE substitui_documento_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_qa_docs_substituido_por
  ON public.qa_documentos_cliente(substituido_por_documento_id)
  WHERE substituido_por_documento_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_qa_docs_ativos_cliente
  ON public.qa_documentos_cliente(qa_cliente_id, tipo_documento)
  WHERE substituido_em IS NULL;