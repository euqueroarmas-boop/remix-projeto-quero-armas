-- =============================================================================
-- (a) O extrato do INSS de CLT estava SEM GRUPO no catálogo do serviço 60.
-- Holerite e CTPS têm grupo_checklist='ocupacao'; só essa linha ficou vazia,
-- e por isso o item escorregava de grupo no checklist e no painel.
-- Correção pontual: preenche o grupo na linha do catálogo e na exigência já
-- criada no processo do Igor (cliente 235). Nada mais é tocado.
-- =============================================================================

UPDATE public.qa_servicos_documentos
   SET regra_validacao = jsonb_set(
         COALESCE(regra_validacao, '{}'::jsonb), '{grupo_checklist}', '"ocupacao"', true)
 WHERE servico_id = 60
   AND tipo_documento = 'renda_extrato_inss'
   AND condicao_profissional = 'clt'
   AND COALESCE(regra_validacao ->> 'grupo_checklist', '') <> 'ocupacao';

UPDATE public.qa_processo_documentos
   SET regra_validacao = jsonb_set(
         COALESCE(regra_validacao, '{}'::jsonb), '{grupo_checklist}', '"ocupacao"', true)
 WHERE processo_id = '3c40ff08-5377-4090-9be2-894a8b04bb43'
   AND tipo_documento = 'renda_extrato_inss'
   AND COALESCE(regra_validacao ->> 'grupo_checklist', '') <> 'ocupacao';
