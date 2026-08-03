ALTER TABLE public.qa_servicos_documentos REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.qa_servicos_documentos;