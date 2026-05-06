-- Permitir status 'revisao_obrigatoria' em qa_gte_documentos
ALTER TABLE public.qa_gte_documentos
  DROP CONSTRAINT IF EXISTS qa_gte_documentos_status_processamento_check;
ALTER TABLE public.qa_gte_documentos
  ADD CONSTRAINT qa_gte_documentos_status_processamento_check
  CHECK (status_processamento = ANY (ARRAY[
    'pendente'::text,
    'processando'::text,
    'concluido'::text,
    'erro'::text,
    'revisao_obrigatoria'::text
  ]));