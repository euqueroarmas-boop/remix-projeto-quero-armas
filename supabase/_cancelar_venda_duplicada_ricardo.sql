-- ============================================================================
-- CANCELA A COMPRA DUPLICADA DO RICARDO ADRIANO MIRANDA (cliente 236)
--
-- Extrato confirma UM PIX de R$ 2.997 em 17/08. Existem duas vendas iguais:
--
--   MANTÉM  → venda 344 (legado 9000177) · contrato QAPOSSE20260025
--             criada 15:41:41, pagamento confirmado 15:41:54 (o PIX real)
--   CANCELA → venda 345 (legado 9000178) · contrato QAPOSSE20260026
--             criada 15:45:57, "pagamento" confirmado à mão sem dinheiro novo
--
-- O que o script faz (nada é apagado — tudo vira histórico):
--   venda 345           → CANCELADO
--   itens da venda 345  → CANCELADO
--   contrato ...0026    → rejected + arquivado_em/motivo
--   3 processos da 345  → cancelado (somem do painel e do portal do cliente)
--   3 solicitações      → arquivadas
--   + eventos de auditoria em venda, contrato e processos
--
-- Os documentos que o cliente já enviou continuam intactos: eles vivem no
-- acervo do cliente e já estão vinculados também aos processos da venda 344.
--
-- Rode inteiro de uma vez. O SELECT do fim mostra como as duas levas ficaram.
-- ============================================================================

BEGIN;

-- 1) Venda duplicada ---------------------------------------------------------
UPDATE public.qa_vendas
   SET status = 'CANCELADO'
 WHERE id = 345;

-- 2) Itens da venda duplicada (a tabela referencia a venda pelo id legado) ---
UPDATE public.qa_itens_venda
   SET status = 'CANCELADO'
 WHERE venda_id IN (345, 9000178);

-- 3) Contrato da venda duplicada --------------------------------------------
UPDATE public.qa_contracts
   SET status           = 'rejected',
       arquivado_em     = now(),
       arquivado_motivo = 'compra_duplicada:cliente fechou o mesmo carrinho duas vezes em 17/08; extrato confirma um unico PIX de R$ 2.997 (venda 344). Venda 345 cancelada.'
 WHERE (venda_id IN (345, 9000178))
   AND arquivado_em IS NULL;

INSERT INTO public.qa_contract_events (contract_id, event_type, event_payload)
SELECT ct.id,
       'contrato_arquivado_compra_duplicada',
       jsonb_build_object(
         'venda_id', 345,
         'venda_mantida', 344,
         'motivo', 'compra duplicada — um unico PIX confirmado no extrato'
       )
  FROM public.qa_contracts ct
 WHERE ct.venda_id IN (345, 9000178);

-- 4) Processos da venda duplicada -------------------------------------------
INSERT INTO public.qa_processo_eventos (processo_id, tipo_evento, descricao, ator, dados_json)
SELECT p.id,
       'processo_cancelado_compra_duplicada',
       'Processo cancelado: nasceu da venda 345, compra duplicada do mesmo carrinho. O atendimento segue nos processos da venda 344.',
       'sistema',
       jsonb_build_object('venda_cancelada', 345, 'venda_mantida', 344,
                          'servico_id', p.servico_id, 'servico_nome', p.servico_nome)
  FROM public.qa_processos p
 WHERE p.venda_id = 345
   AND p.status <> 'cancelado';

UPDATE public.qa_processos
   SET status = 'cancelado'
 WHERE venda_id = 345
   AND status <> 'cancelado';

-- 5) Solicitações de serviço da venda duplicada ------------------------------
UPDATE public.qa_solicitacoes_servico
   SET arquivado           = true,
       arquivado_em        = now(),
       motivo_arquivamento = 'Compra duplicada: venda 345 cancelada (um unico PIX confirmado). Atendimento segue pela venda 344.'
 WHERE venda_id = 345
   AND arquivado = false;

-- 6) Auditoria na venda e no financeiro --------------------------------------
INSERT INTO public.qa_venda_eventos (venda_id, cliente_id, tipo_evento, descricao, ator, dados_json)
VALUES (345, 236, 'venda_cancelada_compra_duplicada',
        'Venda cancelada: o cliente fechou o mesmo carrinho duas vezes em 17/08 e o extrato mostra um unico PIX de R$ 2.997. A venda 344 permanece ativa.',
        'sistema',
        jsonb_build_object('venda_cancelada', 345, 'venda_mantida', 344,
                           'valor', 2997, 'conferido_no_extrato', true));

INSERT INTO public.qa_pagamento_auditoria (venda_id, cliente_id, campo, valor_anterior, valor_novo, origem, ator, contexto)
VALUES (345, 236, 'venda_cancelada_compra_duplicada', 'PAGO', 'CANCELADO', 'manual_admin', 'sistema',
        jsonb_build_object('motivo', 'compra duplicada — pagamento unico confirmado no extrato',
                           'venda_mantida', 344));

COMMIT;

-- ── Conferência: como ficaram as duas levas ─────────────────────────────────
SELECT v.id                       AS venda,
       v.status                   AS status_venda,
       ct.contract_number         AS contrato,
       ct.status                  AS status_contrato,
       p.servico_nome             AS servico,
       p.status                   AS status_processo,
       (SELECT count(*) FROM public.qa_processo_documentos d
         WHERE d.processo_id = p.id
           AND d.arquivo_storage_key IS NOT NULL) AS arquivos_no_processo
  FROM public.qa_vendas v
  LEFT JOIN public.qa_contracts ct
         ON ct.venda_id IN (v.id, v.id_legado)
  LEFT JOIN public.qa_processos p
         ON p.venda_id = v.id
 WHERE v.id IN (344, 345)
 ORDER BY v.id, p.servico_nome;
