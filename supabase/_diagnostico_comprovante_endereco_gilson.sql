-- ============================================================================
-- DIAGNÓSTICO: comprovante de residência que não sai da pendência (caso Gilson)
--
-- Rode os 4 blocos NA ORDEM, no SQL Editor do Supabase. Troque o nome no
-- bloco 1 se precisar. Nada aqui altera dado, exceto o bloco 4 (que só
-- reexecuta o motor oficial de reaproveitamento — é idempotente e seguro).
-- ============================================================================

-- 1) Quem é o cliente
SELECT id, nome_completo, cpf, customer_id
FROM public.qa_clientes
WHERE nome_completo ILIKE '%gilson%'
ORDER BY id;

-- 2) O que existe no Hub Documental para endereço, e se ainda está válido.
--    "vencido" aqui é a razão pela qual o banco NÃO fecha o item do checklist.
SELECT
  dc.id,
  dc.tipo_documento,
  dc.status,
  dc.data_emissao,
  dc.data_validade,
  CASE
    WHEN dc.data_validade IS NULL THEN 'sem data de validade'
    WHEN dc.data_validade >= CURRENT_DATE THEN 'valido'
    ELSE 'vencido'
  END AS situacao_validade,
  EXTRACT(YEAR FROM COALESCE(dc.data_emissao, dc.created_at))::int AS ano_do_documento,
  dc.created_at,
  dc.updated_at
FROM public.qa_documentos_cliente dc
JOIN public.qa_clientes qc
  ON qc.id = dc.qa_cliente_id OR qc.customer_id = dc.customer_id
WHERE qc.nome_completo ILIKE '%gilson%'
  AND dc.tipo_documento ILIKE 'comprovante%'
  AND dc.status <> 'excluido'
ORDER BY dc.created_at DESC;

-- 3) O que o checklist do processo ainda cobra de endereço, e por quê.
SELECT
  pd.id,
  pd.processo_id,
  pd.tipo_documento,
  pd.nome_documento,
  pd.status,
  pd.ano_competencia,
  pd.obrigatorio,
  pd.arquivo_storage_key,
  pd.data_envio,
  pd.data_validacao
FROM public.qa_processo_documentos pd
JOIN public.qa_clientes qc ON qc.id = pd.cliente_id
WHERE qc.nome_completo ILIKE '%gilson%'
  AND (pd.tipo_documento ILIKE 'comprovante%' OR pd.nome_documento ILIKE '%residência%'
       OR pd.nome_documento ILIKE '%residencia%' OR pd.nome_documento ILIKE '%endereço%')
ORDER BY pd.processo_id, pd.tipo_documento;

-- 4) Reexecuta o motor oficial de reaproveitamento para este cliente.
--    Devolve QUANTOS itens do checklist foram fechados. Se devolver 0 e o
--    bloco 2 mostrar tudo "vencido", está confirmado: o único comprovante do
--    acervo está fora da validade e o item continua (corretamente) em aberto —
--    falta o cliente conseguir ENVIAR o comprovante novo.
SELECT
  qc.id AS cliente_id,
  qc.nome_completo,
  public.qa_processo_rever_exigencias(qc.id) AS itens_fechados
FROM public.qa_clientes qc
WHERE qc.nome_completo ILIKE '%gilson%'
ORDER BY qc.id;

-- 5) Conferência DEPOIS de o cliente reenviar o comprovante pelo portal:
--    o novo documento tem que aparecer aprovado e válido, o antigo com
--    status 'substituido', e o item do checklist com status 'aprovado'.
SELECT
  dc.id, dc.tipo_documento, dc.status, dc.data_emissao, dc.data_validade,
  dc.substitui_documento_id, dc.substituido_por_documento_id, dc.created_at
FROM public.qa_documentos_cliente dc
JOIN public.qa_clientes qc
  ON qc.id = dc.qa_cliente_id OR qc.customer_id = dc.customer_id
WHERE qc.nome_completo ILIKE '%gilson%'
  AND dc.tipo_documento ILIKE 'comprovante%'
ORDER BY dc.created_at DESC;
