-- 1) Atualiza a regra de validação para todos os documentos PJ existentes
UPDATE public.qa_processo_documentos
SET regra_validacao = jsonb_set(
      coalesce(regra_validacao, '{}'::jsonb),
      '{exige}',
      '["razao_social"]'::jsonb,
      true
    )
WHERE tipo_documento IN ('renda_qsa','renda_contrato_social');

-- 2) Limpa o estado "invalido" gerado pela regra errada para que o cliente reenvie
UPDATE public.qa_processo_documentos
SET status = 'pendente',
    motivo_rejeicao = NULL,
    validacao_ia_status = NULL,
    validacao_ia_erro = NULL,
    arquivo_storage_key = NULL,
    arquivo_url = NULL,
    data_envio = NULL,
    dados_extraidos_json = NULL,
    divergencias_json = NULL,
    validacao_ia_confianca = NULL,
    validacao_ia_modelo = NULL
WHERE tipo_documento IN ('renda_qsa','renda_contrato_social')
  AND status = 'invalido'
  AND coalesce(motivo_rejeicao,'') ILIKE '%nome_titular%';