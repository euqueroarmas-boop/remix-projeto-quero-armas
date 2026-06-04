-- Fase 14: limpeza pontual dos dados de teste controlado.
ALTER TABLE public.qa_processo_eventos DISABLE TRIGGER trg_qa_processo_eventos_imut_upd;
DELETE FROM public.qa_processo_eventos
 WHERE processo_id = '00000000-0000-0000-0000-000000000f14'
    OR documento_id = '00000000-0000-0000-0000-000000000d14';
ALTER TABLE public.qa_processo_eventos ENABLE TRIGGER trg_qa_processo_eventos_imut_upd;

DELETE FROM public.qa_processo_documentos WHERE id = '00000000-0000-0000-0000-000000000d14';
DELETE FROM public.qa_processos WHERE id = '00000000-0000-0000-0000-000000000f14';
