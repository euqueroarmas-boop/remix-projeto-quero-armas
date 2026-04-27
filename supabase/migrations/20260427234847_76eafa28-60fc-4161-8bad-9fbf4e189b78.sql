ALTER TABLE public.qa_processo_documentos DROP CONSTRAINT IF EXISTS chk_qa_processo_doc_status;
ALTER TABLE public.qa_processo_documentos ADD CONSTRAINT chk_qa_processo_doc_status
CHECK (status IN ('pendente','enviado','em_analise','aprovado','invalido','divergente','revisao_humana','dispensado_grupo'));