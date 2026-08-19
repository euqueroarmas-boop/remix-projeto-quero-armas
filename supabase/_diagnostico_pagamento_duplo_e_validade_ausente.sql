-- ============================================================================
-- A) O DINHEIRO DO RICARDO ENTROU DUAS VEZES?
--
--    Duas vendas (344 e 345), ambas PIX, ambas R$ 2.997, ambas marcadas PAGO,
--    ambas do dia 17/08 — cada uma gerando os mesmos três processos. O campo
--    `pagamento_id` está nulo nas seis linhas, então o registro da venda não
--    prova nada sozinho. Quem prova é o webhook do Asaas: um evento de
--    pagamento confirmado por venda significa duas cobranças de verdade;
--    um só (ou nenhum) significa venda marcada PAGO por outro caminho.
--    A auditoria mostra QUEM marcou e de onde.
--
-- B) O BURACO DA VALIDADE — vale para todos, não só para o Gilson.
--
--    O cartão CNPJ dele está no acervo SEM data de validade. Por isso não
--    apareceu na prévia da varredura nem na lista de "fora do alcance": não há
--    data para vencer. O catálogo, porém, marca o documento com `validade_dias`
--    — ou seja, ele SIM tem prazo. Documento assim envelhece em silêncio e só
--    é descoberto na mesa do protocolo.
--
--    Este bloco lista toda exigência entregue cujo catálogo define prazo mas
--    cujo arquivo no acervo não tem data de validade registrada.
-- ============================================================================

SELECT 'A1 · WEBHOOK DO ASAAS (o dinheiro de verdade)' AS bloco,
       1 AS ord,
       'venda ' || w.venda_id::text AS origem,
       jsonb_build_object(
         'evento',           w.event,
         'asaas_payment_id', w.asaas_payment_id,
         'status',           w.status,
         'recebido_em',      w.created_at,
         'processado_em',    w.processed_at,
         'erro',             w.error_message
       ) AS dados
  FROM public.qa_asaas_webhook_events w
 WHERE w.venda_id IN (344, 345)

UNION ALL

SELECT 'A2 · QUEM MARCOU A VENDA COMO PAGA' AS bloco,
       2 AS ord,
       'venda ' || a.venda_id::text AS origem,
       jsonb_build_object(
         'campo',          a.campo,
         'de',             a.valor_anterior,
         'para',           a.valor_novo,
         'origem_registro', a.origem,
         'ator',           a.ator,
         'quando',         a.created_at,
         'contexto',       a.contexto
       ) AS dados
  FROM public.qa_pagamento_auditoria a
 WHERE a.venda_id IN (344, 345)

UNION ALL

SELECT 'B · DOCUMENTO COM PRAZO, MAS SEM DATA DE VALIDADE' AS bloco,
       3 AS ord,
       c.nome_completo AS origem,
       jsonb_build_object(
         'servico',        p.servico_nome,
         'exigencia',      pd.tipo_documento,
         'nome_documento', pd.nome_documento,
         'status_slot',    pd.status,
         'prazo_catalogo_dias', pd.validade_dias,
         'entregue_em',    pd.data_envio,
         'dias_desde_entrega', (CURRENT_DATE - pd.data_envio::date),
         'ja_passou_do_prazo',
           (pd.data_envio IS NOT NULL
            AND (CURRENT_DATE - pd.data_envio::date) > pd.validade_dias),
         'validade_no_acervo', dc.data_validade
       ) AS dados
  FROM public.qa_processo_documentos pd
  JOIN public.qa_processos p ON p.id = pd.processo_id
  JOIN public.qa_clientes  c ON c.id = p.cliente_id
  JOIN public.qa_documentos_cliente dc
    ON dc.arquivo_storage_path = pd.arquivo_storage_key
 WHERE public.qa_processo_em_aberto(p.status)
   AND pd.validade_dias IS NOT NULL
   AND dc.data_validade IS NULL
   AND pd.status IN (
     'aprovado', 'validado', 'entregue_pelo_hub',
     'dispensado', 'dispensado_grupo', 'dispensado_por_reaproveitamento'
   )

 ORDER BY ord, origem;
