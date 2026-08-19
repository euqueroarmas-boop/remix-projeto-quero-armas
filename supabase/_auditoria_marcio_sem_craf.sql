-- ============================================================================
-- POR QUE O MARCIO NÃO TEM O PROCESSO DE CRAF/GT
--
-- CONSULTA ÚNICA (o editor exporta só o último resultado). Põe a venda do
-- Marcio e a do Ricardo lado a lado, item por item, para achar onde o CRAF/GT
-- se perdeu: se não entrou no carrinho, se não entrou no contrato, ou se a
-- liberação tentou criar o processo e falhou.
--
--   bloco 1 → vendas dos dois (valor, origem, status)
--   bloco 2 → itens de cada venda (o que foi de fato vendido)
--   bloco 3 → itens de cada contrato (o que o contrato listou)
--   bloco 4 → processos criados
--   bloco 5 → solicitações de serviço criadas
--   bloco 6 → TODOS os eventos dos contratos (é aqui que aparece erro de
--             liberação, item pulado ou serviço fora do catálogo)
--   bloco 7 → log do backend nas horas das duas liberações
--
-- NÃO ALTERA NADA. É tudo SELECT.
-- ============================================================================

WITH cli AS (
  SELECT c.id, c.id_legado, c.nome_completo
    FROM public.qa_clientes c
   WHERE c.nome_completo ILIKE '%RICARDO%ADRIANO%MIRANDA%'
      OR c.nome_completo ILIKE '%MARCIO%GERALDO%FREIRE%'
),
vend AS (
  SELECT v.*
    FROM public.qa_vendas v
   WHERE v.cliente_id IN (SELECT id_legado FROM cli WHERE id_legado IS NOT NULL)
      OR v.cliente_id IN (SELECT id FROM cli)
),
ctr AS (
  SELECT ct.*
    FROM public.qa_contracts ct
   WHERE ct.venda_id IN (SELECT id FROM vend)
      OR ct.venda_id IN (SELECT id_legado FROM vend WHERE id_legado IS NOT NULL)
)

SELECT '1 · VENDAS'::text AS bloco,
       1 AS ord,
       ((SELECT nome_completo FROM cli
          WHERE id_legado = v.cliente_id OR id = v.cliente_id LIMIT 1)
        || ' · venda ' || v.id::text)::text AS quem,
       jsonb_build_object(
         'venda_id', v.id, 'id_legado', v.id_legado,
         'criada_em', v.created_at, 'status', v.status,
         'cobranca_status', v.cobranca_status, 'cobranca_origem', v.cobranca_origem,
         'origem_proposta', v.origem_proposta, 'forma_pagamento', v.forma_pagamento,
         'valor_a_pagar', v.valor_a_pagar,
         'valor_total_pago_cliente', v.valor_total_pago_cliente
       ) AS dados
  FROM vend v

UNION ALL

SELECT '2 · ITENS DA VENDA'::text, 2,
       ('venda ' || iv.venda_id::text || ' · servico ' || COALESCE(iv.servico_id::text, '-'))::text,
       jsonb_build_object(
         'item_id', iv.id, 'venda_id', iv.venda_id, 'servico_id', iv.servico_id,
         'servico_nome', (SELECT s.nome_servico FROM public.qa_servicos s WHERE s.id = iv.servico_id),
         'valor', iv.valor, 'status', iv.status,
         'tipo_venda', iv.tipo_venda, 'sort_order', iv.sort_order
       )
  FROM public.qa_itens_venda iv
 WHERE iv.venda_id IN (SELECT id FROM vend)
    OR iv.venda_id IN (SELECT id_legado FROM vend WHERE id_legado IS NOT NULL)

UNION ALL

SELECT '3 · ITENS DO CONTRATO'::text, 3,
       ((SELECT ct.contract_number FROM ctr ct WHERE ct.id = ci.contract_id)
        || ' · ' || COALESCE(ci.service_slug_snapshot, '-'))::text,
       jsonb_build_object(
         'contract_id', ci.contract_id, 'venda_id', ci.venda_id,
         'item_venda_id', ci.item_venda_id,
         'slug', ci.service_slug_snapshot, 'nome', ci.service_name_snapshot,
         'servico_id', ci.service_id_snapshot,
         'valor_unitario_cents', ci.unit_price_cents, 'total_cents', ci.total_price_cents
       )
  FROM public.qa_contract_items ci
 WHERE ci.contract_id IN (SELECT id FROM ctr)

UNION ALL

SELECT '4 · PROCESSOS'::text, 4,
       ((SELECT nome_completo FROM cli WHERE id = p.cliente_id LIMIT 1)
        || ' · ' || p.servico_nome)::text,
       jsonb_build_object(
         'processo_id', p.id, 'venda_id', p.venda_id, 'servico_id', p.servico_id,
         'status', p.status, 'pagamento_status', p.pagamento_status,
         'criado_em', p.data_criacao, 'solicitacao_id', p.solicitacao_id,
         'docs_no_checklist', (SELECT count(*) FROM public.qa_processo_documentos d
                                WHERE d.processo_id = p.id)
       )
  FROM public.qa_processos p
 WHERE p.cliente_id IN (SELECT id FROM cli)
    OR p.cliente_id IN (SELECT id_legado FROM cli WHERE id_legado IS NOT NULL)

UNION ALL

SELECT '5 · SOLICITAÇÕES'::text, 5,
       ((SELECT nome_completo FROM cli WHERE id = so.cliente_id LIMIT 1)
        || ' · ' || so.service_name)::text,
       jsonb_build_object(
         'solicitacao_id', so.id, 'venda_id', so.venda_id,
         'item_venda_id', so.item_venda_id, 'servico_id', so.servico_id,
         'slug', so.service_slug, 'origem', so.origem,
         'status_servico', so.status_servico, 'status_processo', so.status_processo,
         'processo_id', so.processo_id, 'criada_em', so.created_at,
         'sem_checklist_configurado', so.sem_checklist_configurado
       )
  FROM public.qa_solicitacoes_servico so
 WHERE so.cliente_id IN (SELECT id FROM cli)
    OR so.cliente_id IN (SELECT id_legado FROM cli WHERE id_legado IS NOT NULL)

UNION ALL

SELECT '6 · EVENTOS DOS CONTRATOS'::text, 6,
       (to_char(ce.created_at, 'DD/MM HH24:MI:SS') || ' · '
        || (SELECT ct.contract_number FROM ctr ct WHERE ct.id = ce.contract_id)
        || ' · ' || ce.event_type)::text,
       jsonb_build_object('evento', ce.event_type, 'quando', ce.created_at,
                          'payload', ce.event_payload)
  FROM public.qa_contract_events ce
 WHERE ce.contract_id IN (SELECT id FROM ctr)

UNION ALL

SELECT '7 · LOG DO BACKEND NAS LIBERAÇÕES'::text, 7,
       (to_char(l.created_at, 'DD/MM HH24:MI:SS') || ' · ' || COALESCE(l.tipo, '-'))::text,
       jsonb_build_object('mensagem', l.mensagem, 'status', l.status,
                          'payload', l.payload, 'quando', l.created_at)
  FROM public.logs_sistema l
 WHERE l.created_at >= (SELECT min(created_at) FROM vend)
   AND (l.mensagem ILIKE '%libera%'
     OR l.mensagem ILIKE '%processo%'
     OR l.mensagem ILIKE '%checklist%'
     OR l.payload::text ILIKE '%craf%'
     OR l.payload::text ILIKE '%346%')

 ORDER BY ord, quem;
