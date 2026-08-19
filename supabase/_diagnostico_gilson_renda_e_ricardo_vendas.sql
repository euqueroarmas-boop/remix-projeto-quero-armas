-- ============================================================================
-- DUAS PONTAS SOLTAS, UMA CONSULTA SÓ
--
-- A) ONDE ESTÁ O CARTÃO CNPJ DO GILSON. Ele não apareceu na prévia da
--    varredura (logo, não vence nos próximos 30 dias pelo que o acervo diz)
--    e também não apareceu na lista de "fora do alcance" (logo, TEM par no
--    acervo). As duas coisas juntas só fecham se a validade registrada for
--    nula ou diferente da que a auditoria mostrou. Este bloco põe as duas
--    pontas lado a lado — o slot do processo e a linha do acervo — para
--    todos os documentos de renda dele.
--
-- B) O RICARDO PAGOU DUAS VEZES? Os seis processos nasceram em duas levas do
--    dia 17/08: 16:07 e 16:27, cada leva com os mesmos três serviços. Cada
--    processo carrega `venda_id` (índice único: uma venda gera no máximo um
--    processo), então duas levas = duas vendas. Este bloco mostra a venda, o
--    valor e a forma de pagamento de cada um. Antes de cancelar qualquer
--    processo é preciso saber se houve cobrança em dobro.
-- ============================================================================

SELECT 'A · RENDA DO GILSON, DOS DOIS LADOS' AS bloco,
       1 AS ord,
       pd.nome_documento AS origem,
       jsonb_build_object(
         'exigencia',        pd.tipo_documento,
         'status_slot',      pd.status,
         'entregue_em',      pd.data_envio,
         'storage_key_slot', pd.arquivo_storage_key,
         'achou_no_acervo',  (dc.id IS NOT NULL),
         'status_acervo',    dc.status,
         'validade_acervo',  dc.data_validade,
         'dias_ate_vencer',  dc.data_validade - CURRENT_DATE,
         'acervo_criado_em', dc.created_at
       ) AS dados
  FROM public.qa_processo_documentos pd
  JOIN public.qa_processos p ON p.id = pd.processo_id
  JOIN public.qa_clientes   c ON c.id = p.cliente_id
  LEFT JOIN public.qa_documentos_cliente dc
    ON dc.arquivo_storage_path = pd.arquivo_storage_key
 WHERE c.nome_completo ILIKE '%GILSON DO NASCIMENTO%'
   AND p.status NOT IN ('cancelado', 'excluido_lgpd')
   AND pd.tipo_documento LIKE 'renda%'

UNION ALL

-- Tudo que o acervo do Gilson tem com validade, mesmo sem slot ligado.
SELECT 'A · RENDA DO GILSON, DOS DOIS LADOS' AS bloco,
       1 AS ord,
       '(acervo) ' || coalesce(dc.nome_documento, dc.tipo_documento) AS origem,
       jsonb_build_object(
         'exigencia',        dc.tipo_documento,
         'status_slot',      '(sem slot)',
         'storage_key_slot', dc.arquivo_storage_path,
         'achou_no_acervo',  true,
         'status_acervo',    dc.status,
         'validade_acervo',  dc.data_validade,
         'dias_ate_vencer',  dc.data_validade - CURRENT_DATE,
         'acervo_criado_em', dc.created_at
       ) AS dados
  FROM public.qa_documentos_cliente dc
  JOIN public.qa_clientes c ON c.id = dc.cliente_id
 WHERE c.nome_completo ILIKE '%GILSON DO NASCIMENTO%'
   AND dc.tipo_documento LIKE 'renda%'
   AND NOT EXISTS (
     SELECT 1
       FROM public.qa_processo_documentos pd2
       JOIN public.qa_processos p2 ON p2.id = pd2.processo_id
      WHERE pd2.arquivo_storage_key = dc.arquivo_storage_path
        AND p2.cliente_id = c.id
   )

UNION ALL

SELECT 'B · VENDAS POR TRÁS DOS PROCESSOS DO RICARDO' AS bloco,
       2 AS ord,
       to_char(p.created_at, 'HH24:MI') || ' · ' || p.servico_nome AS origem,
       jsonb_build_object(
         'processo_id',      p.id,
         'criado_em',        p.created_at,
         'venda_id',         p.venda_id,
         'pagamento_id',     p.pagamento_id,
         'pagamento_status', p.pagamento_status,
         'venda_valor',      v.valor_a_pagar,
         'venda_desconto',   v.desconto,
         'venda_forma',      v.forma_pagamento,
         'venda_status',     v.status,
         'venda_cadastro',   v.data_cadastro,
         'itens_da_venda',   (SELECT count(*) FROM public.qa_itens_venda iv
                               WHERE iv.venda_id = p.venda_id),
         'itens_valor_total',(SELECT coalesce(sum(iv.valor), 0) FROM public.qa_itens_venda iv
                               WHERE iv.venda_id = p.venda_id)
       ) AS dados
  FROM public.qa_processos p
  JOIN public.qa_clientes  c ON c.id = p.cliente_id
  LEFT JOIN public.qa_vendas v ON v.id = p.venda_id
 WHERE c.nome_completo ILIKE '%RICARDO ADRIANO MIRANDA%'
   AND p.status NOT IN ('cancelado', 'excluido_lgpd')

 ORDER BY ord, origem;
