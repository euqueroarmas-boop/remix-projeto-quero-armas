-- E2E test setup: migrar processos de teste para o cliente Willian (auth vinculado)
-- Cliente origem: 91 (João Luiz - sem auth)
-- Cliente destino: 46 (Willian - auth willmassaroto@gmail.com)
UPDATE public.qa_processos
   SET cliente_id = 46
 WHERE id IN (
   '5808645d-51be-42a3-89ed-5909cb8894fd',
   'acc5cf46-7fff-4713-82e2-7aec963881c0'
 );

-- Registrar evento de auditoria da migração
INSERT INTO public.qa_processo_eventos (processo_id, tipo_evento, descricao, dados_json, ator)
SELECT id, 'processo_realocado', 'E2E TEST: processo migrado de cliente 91 para 46 (Willian) para validação real de portal',
       jsonb_build_object('de_cliente', 91, 'para_cliente', 46), 'sistema'
  FROM public.qa_processos
 WHERE id IN ('5808645d-51be-42a3-89ed-5909cb8894fd','acc5cf46-7fff-4713-82e2-7aec963881c0');