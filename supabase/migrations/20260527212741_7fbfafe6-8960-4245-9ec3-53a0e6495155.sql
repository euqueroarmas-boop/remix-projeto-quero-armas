ALTER TABLE public.qa_processo_documentos ADD COLUMN IF NOT EXISTS ordem INTEGER;
CREATE INDEX IF NOT EXISTS idx_qa_processo_documentos_ordem ON public.qa_processo_documentos (processo_id, ordem);