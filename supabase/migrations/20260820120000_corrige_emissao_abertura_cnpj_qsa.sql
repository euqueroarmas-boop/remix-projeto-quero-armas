-- ============================================================================
-- CARTÃO CNPJ / QSA gravados com a DATA DE ABERTURA da empresa no lugar da
-- data de emissão (rodapé "Emitido no dia DD/MM/AAAA").
--
-- Quando o parser local não lia o PDF, a IA devolvia a data de abertura como
-- emissão. Com a regra "validade = emissão + 30 dias", um cartão de empresa
-- aberta em 2008 nascia VENCIDO em 08/03/2008 — e como o QSA herda a emissão
-- do cartão CNPJ aprovado, o cliente ficava travado no envio do QSA
-- ("DOCUMENTO VENCIDO — SERÁ REJEITADO").
--
-- Correção: emissão presumida pela data do ENVIO (essas consultas da Receita
-- são impressas na hora do download), validade = emissão + 30 dias. Os valores
-- antigos ficam registrados em ia_dados_extraidos para auditoria.
-- Alcança apenas linhas cuja emissão está a mais de 60 dias do envio — um
-- documento legítimo nunca chega com essa distância; a data de abertura erra
-- por anos.
-- ============================================================================

UPDATE public.qa_documentos_cliente
SET
  data_emissao  = (created_at AT TIME ZONE 'America/Sao_Paulo')::date,
  data_validade = (created_at AT TIME ZONE 'America/Sao_Paulo')::date + 30,
  ia_dados_extraidos = COALESCE(ia_dados_extraidos, '{}'::jsonb) || jsonb_build_object(
    'correcao_emissao_abertura', jsonb_build_object(
      'corrigido_em', now(),
      'data_emissao_anterior', data_emissao,
      'data_validade_anterior', data_validade,
      'motivo', 'IA leu a DATA DE ABERTURA da empresa como emissão; emissão presumida pela data do envio'
    )
  )
WHERE tipo_documento IN (
    'renda_cartao_cnpj', 'cartao_cnpj_mei', 'renda_cnpj_autonomo',
    'renda_qsa', 'cartao_cnpj', 'qsa'
  )
  AND status NOT IN ('substituido', 'excluido')
  AND data_emissao IS NOT NULL
  AND data_emissao < (created_at AT TIME ZONE 'America/Sao_Paulo')::date - 60;

-- Conferência: lista o que foi corrigido (deve incluir o cartão CNPJ e o QSA
-- de clientes travados; depois da correção, data_validade fica no futuro).
SELECT
  qa_cliente_id,
  tipo_documento,
  status,
  data_emissao,
  data_validade,
  ia_dados_extraidos -> 'correcao_emissao_abertura' AS correcao
FROM public.qa_documentos_cliente
WHERE ia_dados_extraidos ? 'correcao_emissao_abertura'
ORDER BY updated_at DESC;
