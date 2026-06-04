-- Corrige exigência indevida de nome_titular em documentos empresariais/autônomo
-- Esses documentos identificam CNPJ/razão social/emitente/sócios, não um titular PF único.

UPDATE public.qa_servicos_documentos
   SET regra_validacao = jsonb_set(
         COALESCE(regra_validacao, '{}'::jsonb),
         '{exige}',
         '["razao_social"]'::jsonb,
         true
       ),
       updated_at = now()
 WHERE tipo_documento IN (
   'renda_cartao_cnpj',
   'renda_cnpj_autonomo',
   'renda_qsa',
   'renda_contrato_social',
   'renda_nf_empresa',
   'renda_nf_recente'
 );

UPDATE public.qa_processo_documentos
   SET regra_validacao = jsonb_set(
         COALESCE(regra_validacao, '{}'::jsonb),
         '{exige}',
         '["razao_social"]'::jsonb,
         true
       ),
       updated_at = now()
 WHERE tipo_documento IN (
   'renda_cartao_cnpj',
   'renda_cnpj_autonomo',
   'renda_qsa',
   'renda_contrato_social',
   'renda_nf_empresa',
   'renda_nf_recente'
 );

-- Reabre somente documentos travados por essa regra específica, sem aprovar nada automaticamente.
UPDATE public.qa_processo_documentos
   SET status = 'pendente',
       motivo_rejeicao = NULL,
       validacao_ia_status = NULL,
       validacao_ia_erro = NULL,
       validacao_ia_confianca = NULL,
       validacao_ia_modelo = NULL,
       data_validacao = NULL,
       updated_at = now()
 WHERE tipo_documento IN (
   'renda_cartao_cnpj',
   'renda_cnpj_autonomo',
   'renda_qsa',
   'renda_contrato_social',
   'renda_nf_empresa',
   'renda_nf_recente'
 )
   AND status = 'invalido'
   AND (
     COALESCE(motivo_rejeicao, '') ILIKE '%nome_titular%'
     OR COALESCE(motivo_rejeicao, '') ILIKE '%razao_social%'
   );

INSERT INTO public.qa_processo_eventos (processo_id, documento_id, tipo_evento, descricao, dados_json, ator)
SELECT d.processo_id,
       d.id,
       'correcao_regra_validacao',
       'Regra corrigida: documentos empresariais/autônomo passam a validar identificação da empresa em vez de nome_titular.',
       jsonb_build_object('tipo_documento', d.tipo_documento, 'exige', jsonb_build_array('razao_social')),
       'sistema'
  FROM public.qa_processo_documentos d
 WHERE d.tipo_documento IN (
   'renda_cartao_cnpj',
   'renda_cnpj_autonomo',
   'renda_qsa',
   'renda_contrato_social',
   'renda_nf_empresa',
   'renda_nf_recente'
 )
   AND d.updated_at > now() - interval '2 minutes';