UPDATE public.qa_servicos_documentos
   SET regra_validacao = COALESCE(regra_validacao, '{}'::jsonb) || jsonb_build_object('exige_documento_quando', 'sim')
 WHERE tipo_documento = 'laudo_psicologico'
   AND regra_validacao->>'tipo' = 'pergunta';

UPDATE public.qa_processo_documentos
   SET regra_validacao = COALESCE(regra_validacao, '{}'::jsonb) || jsonb_build_object('exige_documento_quando', 'sim')
 WHERE tipo_documento = 'laudo_psicologico'
   AND regra_validacao->>'tipo' = 'pergunta';

UPDATE public.qa_processo_documentos
   SET status = 'pendente'
 WHERE tipo_documento = 'laudo_psicologico'
   AND regra_validacao->>'tipo' = 'pergunta'
   AND status = 'dispensado_grupo'
   AND arquivo_storage_key IS NULL;