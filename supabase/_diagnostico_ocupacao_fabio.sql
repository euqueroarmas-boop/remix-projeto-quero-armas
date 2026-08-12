-- =============================================================================
-- DIAGNÓSTICO — Ocupação Lícita do Fábio (SOMENTE LEITURA)
--
-- Responde: por que o checklist foi do CCMEI direto para Idoneidade, sem pedir
-- Cartão CNPJ, QSA e Nota Fiscal.
--
-- NÃO altera nada. São quatro SELECTs — pode rodar em produção sem risco.
-- Ajuste o CPF/nome no bloco `alvo` da primeira consulta se necessário.
-- =============================================================================

-- ── 1) Condição profissional do processo ──────────────────────────────────────
-- É ela que decide QUAIS documentos de renda existem. "autonomo" cria os 4
-- (CCMEI + Cartão CNPJ + QSA + NF). Qualquer outro valor cria um conjunto
-- diferente — e aí os três nunca foram exigidos.
SELECT
  p.id                      AS processo_id,
  c.nome_completo,
  c.cpf,
  p.servico_nome,
  p.status                  AS status_processo,
  p.condicao_profissional,
  p.etapa_liberada_ate
FROM public.qa_processos p
JOIN public.qa_clientes c ON c.id = p.cliente_id
WHERE c.nome_completo ILIKE '%FABIO%'
ORDER BY p.data_criacao DESC;


-- ── 2) As 4 exigências de Ocupação Lícita, uma a uma ─────────────────────────
-- Se as linhas de Cartão CNPJ / QSA / NF simplesmente NÃO aparecerem, elas
-- nunca foram criadas no processo. Se aparecerem com status concluído
-- ('aprovado', 'dispensado_por_reaproveitamento', 'dispensado_grupo',
-- 'nao_aplicavel'), então já estavam satisfeitas e o checklist agiu certo.
SELECT
  pd.tipo_documento,
  pd.nome_documento,
  pd.status,
  pd.obrigatorio,
  pd.etapa,
  pd.ordem,
  pd.data_envio,
  pd.data_validacao,
  pd.data_emissao,
  pd.data_validade,
  (pd.metadados_documento_json ->> 'reutilizado_do_hub')  AS veio_do_hub,
  (pd.metadados_documento_json ->> 'hub_documento_id')    AS hub_documento_id,
  pd.motivo_rejeicao
FROM public.qa_processo_documentos pd
JOIN public.qa_processos p ON p.id = pd.processo_id
JOIN public.qa_clientes  c ON c.id = p.cliente_id
WHERE c.nome_completo ILIKE '%FABIO%'
  AND pd.tipo_documento IN (
    'renda_ccmei',
    'renda_cartao_cnpj',
    'renda_qsa',
    'renda_nf_recente',
    'renda_nf_empresa',
    'renda_contrato_social',
    'renda_definir_condicao'
  )
ORDER BY p.data_criacao DESC, pd.ordem NULLS LAST, pd.tipo_documento;


-- ── 3) O que o Hub do cliente já tinha aprovado ──────────────────────────────
-- Explica o "✓ 6 documentos já reconhecidos do seu histórico". Se o Cartão CNPJ
-- e o QSA estiverem aqui como aprovados, o reaproveitamento os deu por
-- entregues no processo — e é por isso que o checklist não os pediu de novo.
-- Confira também se o CCMEI recém-salvo entrou SEM datas (o que a correção fez).
SELECT
  d.tipo_documento,
  d.nome_documento,
  d.status,
  d.validado_admin,
  d.data_emissao,      -- CCMEI deve estar NULL
  d.data_validade,     -- CCMEI deve estar NULL
  d.numero_documento,
  d.created_at,
  d.updated_at
FROM public.qa_documentos_cliente d
JOIN public.qa_clientes c ON c.id = d.qa_cliente_id
WHERE c.nome_completo ILIKE '%FABIO%'
  AND d.tipo_documento LIKE 'renda_%'
ORDER BY d.updated_at DESC;


-- ── 4) Panorama do grupo inteiro, do jeito que o portal conta ────────────────
-- Reproduz a contagem que o popup mostra ("Ocupação lícita: X de Y").
SELECT
  pd.status,
  COUNT(*) AS qtd,
  string_agg(pd.tipo_documento, ', ' ORDER BY pd.tipo_documento) AS tipos
FROM public.qa_processo_documentos pd
JOIN public.qa_processos p ON p.id = pd.processo_id
JOIN public.qa_clientes  c ON c.id = p.cliente_id
WHERE c.nome_completo ILIKE '%FABIO%'
  AND pd.obrigatorio
  AND (pd.tipo_documento LIKE 'renda_%' OR pd.tipo_documento LIKE 'ocupacao%')
GROUP BY pd.status
ORDER BY qtd DESC;
