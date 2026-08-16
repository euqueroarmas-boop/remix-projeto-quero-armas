-- ============================================================================
-- LEVANTAMENTO FINAL — REQUERIMENTO, PROTOCOLO E LINHA DO TEMPO DA PF
-- ----------------------------------------------------------------------------
-- Bloco 100% de LEITURA (só SELECT). Não altera nada, pode rodar em produção.
-- É o último levantamento: com estes 6 resultados eu fecho o diagnóstico e
-- começo a construir. Rode tudo de uma vez e me mande os 6 resultados.
-- ============================================================================

-- 1) A exigência do requerimento: em quais serviços ela existe e o que o
--    cliente lê hoje no portal (instrução, observação, link de emissão).
--    Confirma se está mesmo só em Posse e Porte.
SELECT sd.servico_id,
       s.nome_servico,
       sd.tipo_documento,
       sd.nome_documento,
       sd.etapa,
       sd.ordem,
       sd.obrigatorio,
       sd.ativo,
       sd.link_emissao,
       sd.modelo_url,
       sd.instrucoes,
       sd.observacoes_cliente,
       sd.regra_validacao
  FROM public.qa_servicos_documentos sd
  LEFT JOIN public.qa_servicos s ON s.id = sd.servico_id
 WHERE sd.tipo_documento ILIKE '%requerimento%'
    OR lower(sd.nome_documento) LIKE '%requerimento%'
 ORDER BY sd.servico_id, sd.etapa, sd.ordem;

-- 2) O texto da Biblioteca de documentos para o requerimento
--    (é o "como enviar" que aparece no pop-up guiado).
SELECT codigo,
       nome,
       categoria,
       ativo,
       emissor_padrao,
       validade_dias,
       link_emissao,
       link_modelo,
       descricao_o_que_e,
       descricao_como_enviar,
       observacao_cliente,
       base_legal
  FROM public.qa_documentos_biblioteca
 WHERE codigo ILIKE '%requerimento%'
    OR lower(nome) LIKE '%requerimento%'
 ORDER BY ativo DESC, nome;

-- 3) Quais status estão REALMENTE em uso hoje nas duas tabelas.
--    A linha do tempo nova (protocolado → em análise PF → notificado →
--    em análise → deferido/indeferido) tem que caber nestes valores.
SELECT 'qa_processos'   AS tabela, coalesce(status, '(nulo)') AS status, count(*) AS qtd
  FROM public.qa_processos
 GROUP BY status
UNION ALL
SELECT 'qa_itens_venda' AS tabela, coalesce(status, '(nulo)') AS status, count(*) AS qtd
  FROM public.qa_itens_venda
 GROUP BY status
 ORDER BY 1, 3 DESC;

-- 4) A PONTE. Este é o resultado mais importante do bloco.
--    As datas da PF (protocolo, notificação, indeferimento, deferimento) e o
--    contador de prazos vivem em qa_itens_venda. O portal do cliente mostra
--    qa_processos. Se não houver ligação entre os dois, a linha do tempo não
--    tem como aparecer para o cliente sem eu criar essa ligação antes.
SELECT count(*)                                             AS processos,
       count(*) FILTER (WHERE p.venda_id IS NOT NULL)       AS com_venda,
       count(iv.id)                                         AS com_item_correspondente,
       count(*) FILTER (WHERE iv.data_protocolo      IS NOT NULL) AS ja_protocolados,
       count(*) FILTER (WHERE iv.data_notificacao    IS NOT NULL) AS com_notificacao,
       count(*) FILTER (WHERE iv.data_indeferimento  IS NOT NULL) AS com_indeferimento,
       count(*) FILTER (WHERE iv.data_deferimento    IS NOT NULL) AS com_deferimento
  FROM public.qa_processos p
  LEFT JOIN public.qa_vendas v
         ON v.id = p.venda_id
  LEFT JOIN public.qa_itens_venda iv
         ON iv.venda_id = v.id_legado
        AND iv.servico_id = p.servico_id;

-- 5) Onde estão os requerimentos hoje: quantos pendentes, quantos entregues.
SELECT tipo_documento,
       status,
       count(*) AS qtd,
       min(created_at) AS mais_antigo,
       max(created_at) AS mais_recente
  FROM public.qa_documentos_cliente
 WHERE tipo_documento ILIKE '%requerimento%'
 GROUP BY tipo_documento, status
 ORDER BY tipo_documento, qtd DESC;

-- 6) Confirmação de que NÃO existe hoje campo para colar o texto do delegado
--    (a justificativa do indeferimento). Se vier vazio, eu crio a coluna.
SELECT table_name, column_name, data_type
  FROM information_schema.columns
 WHERE table_schema = 'public'
   AND (column_name ILIKE '%indeferi%' OR column_name ILIKE '%justificativa%'
        OR column_name ILIKE '%delegado%' OR column_name ILIKE '%decisao%'
        OR column_name ILIKE '%motivo%')
 ORDER BY table_name, column_name;
