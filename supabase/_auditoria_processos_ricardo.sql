-- ============================================================================
-- AUDITORIA: POR QUE O RICARDO ADRIANO MIRANDA TEM TANTOS PROCESSOS
--
-- CONSULTA ÚNICA. O SQL Editor do Supabase exporta só o último resultado,
-- então todos os levantamentos vêm empilhados numa tabela só, separados por
-- `bloco`. NÃO ALTERA NADA — é tudo SELECT.
--
--   bloco 01 → cadastros com esse nome/CPF (o cliente está duplicado?)
--   bloco 02 → o painel devolve linha repetida? (defeito de tela x dado real)
--   bloco 03 → todos os processos dele, com origem e volume de documentos
--   bloco 04 → eventos de criação de cada processo (quem/o quê criou)
--   bloco 05 → todas as vendas dele
--   bloco 06 → itens de cada venda (qual serviço foi vendido em qual venda)
--   bloco 07 → eventos das vendas (quem abriu cada venda e por qual porta)
--   bloco 08 → contratos das vendas
--   bloco 09 → eventos dos contratos (liberação que criou processo)
--   bloco 10 → solicitações de serviço
--   bloco 11 → dinheiro: webhook do Asaas + auditoria de pagamento
--   bloco 12 → panorama da base: outros clientes com processo repetido
--   bloco 13 → panorama da base: processos sem venda (porta manual/RPC aberta)
-- ============================================================================

WITH cli AS (
  SELECT c.*
    FROM public.qa_clientes c
   WHERE c.nome_completo ILIKE '%RICARDO%ADRIANO%MIRANDA%'
      OR (c.cpf IS NOT NULL AND c.cpf IN (
            SELECT c2.cpf FROM public.qa_clientes c2
             WHERE c2.nome_completo ILIKE '%RICARDO%ADRIANO%MIRANDA%'
               AND c2.cpf IS NOT NULL))
),
proc AS (
  SELECT p.*
    FROM public.qa_processos p
   WHERE p.cliente_id IN (SELECT id FROM cli)
      OR p.cliente_id IN (SELECT id_legado FROM cli WHERE id_legado IS NOT NULL)
),
vend AS (
  SELECT v.*
    FROM public.qa_vendas v
   WHERE v.cliente_id IN (SELECT id_legado FROM cli WHERE id_legado IS NOT NULL)
      OR v.cliente_id IN (SELECT id FROM cli)
      OR v.id        IN (SELECT venda_id FROM proc WHERE venda_id IS NOT NULL)
      OR v.id_legado IN (SELECT venda_id FROM proc WHERE venda_id IS NOT NULL)
),
ctr AS (
  SELECT ct.*
    FROM public.qa_contracts ct
   WHERE ct.venda_id  IN (SELECT id FROM vend)
      OR ct.venda_id  IN (SELECT id_legado FROM vend WHERE id_legado IS NOT NULL)
      OR ct.cliente_id IN (SELECT id FROM cli)
      OR ct.cliente_id IN (SELECT id_legado FROM cli WHERE id_legado IS NOT NULL)
),
painel AS (
  SELECT * FROM public.qa_painel_progresso_clientes()
)

-- 01 ─ Cadastros com esse nome/CPF ------------------------------------------
SELECT '01 · CADASTROS COM ESSE NOME/CPF'::text AS bloco,
       1 AS ord,
       ('cliente ' || c.id::text)::text AS origem,
       jsonb_build_object(
         'nome',         c.nome_completo,
         'id_real',      c.id,
         'id_legado',    c.id_legado,
         'cpf',          c.cpf,
         'email',        c.email,
         'user_id',      c.user_id,
         'status',       c.status,
         'origem_cadastro', c.origem,
         'cadastro_publico_id', c.cadastro_publico_id,
         'criado_em',    c.created_at
       ) AS dados
  FROM cli c

UNION ALL

-- 02 ─ O painel repete linha? ------------------------------------------------
SELECT '02 · O PAINEL REPETE LINHA?'::text,
       2,
       ('cliente ' || pa.cliente_id::text)::text,
       jsonb_build_object(
         'linhas_no_painel',      count(*),
         'processos_distintos',   count(DISTINCT pa.processo_id),
         'leitura', CASE WHEN count(*) > count(DISTINCT pa.processo_id)
                         THEN 'DEFEITO DE TELA — a consulta do painel multiplica linhas'
                         ELSE 'DADO REAL — são processos diferentes no banco' END,
         'servicos', jsonb_agg(DISTINCT pa.servico_nome)
       )
  FROM painel pa
 WHERE pa.cliente_id IN (SELECT id FROM cli)
    OR pa.cliente_id IN (SELECT id_legado FROM cli WHERE id_legado IS NOT NULL)
 GROUP BY pa.cliente_id

UNION ALL

-- 03 ─ Todos os processos dele ----------------------------------------------
SELECT '03 · PROCESSOS DELE'::text,
       3,
       (to_char(p.data_criacao, 'DD/MM HH24:MI') || ' · ' || p.servico_nome)::text,
       jsonb_build_object(
         'processo_id',    p.id,
         'servico_id',     p.servico_id,
         'servico_nome',   p.servico_nome,
         'venda_id',       p.venda_id,
         'solicitacao_id', p.solicitacao_id,
         'status',         p.status,
         'pagamento_status', p.pagamento_status,
         'pagamento_id',   p.pagamento_id,
         'cliente_id_gravado', p.cliente_id,
         'modalidade',     p.modalidade,
         'condicao_profissional', p.condicao_profissional,
         'criado_em',      p.data_criacao,
         'created_at',     p.created_at,
         'observacoes_admin', p.observacoes_admin,
         'docs_no_checklist', (SELECT count(*) FROM public.qa_processo_documentos d
                                WHERE d.processo_id = p.id),
         'docs_entregues',    (SELECT count(*) FROM public.qa_processo_documentos d
                                WHERE d.processo_id = p.id
                                  AND d.status IN ('aprovado','validado','entregue_pelo_hub',
                                                   'dispensado','dispensado_grupo',
                                                   'dispensado_por_reaproveitamento')),
         'arquivos_enviados', (SELECT count(*) FROM public.qa_processo_documentos d
                                WHERE d.processo_id = p.id
                                  AND d.arquivo_storage_key IS NOT NULL)
       )
  FROM proc p

UNION ALL

-- 04 ─ Eventos de criação de cada processo -----------------------------------
SELECT '04 · O QUE CRIOU CADA PROCESSO'::text,
       4,
       (to_char(e.created_at, 'DD/MM HH24:MI:SS') || ' · ' || left(e.processo_id::text, 8))::text,
       jsonb_build_object(
         'processo_id',  e.processo_id,
         'servico',      (SELECT p.servico_nome FROM proc p WHERE p.id = e.processo_id),
         'tipo_evento',  e.tipo_evento,
         'descricao',    e.descricao,
         'ator',         e.ator,
         'user_id',      e.user_id,
         'quando',       e.created_at,
         'dados',        e.dados_json
       )
  FROM public.qa_processo_eventos e
 WHERE e.processo_id IN (SELECT id FROM proc)
   AND (e.tipo_evento ILIKE '%criad%'
     OR e.tipo_evento ILIKE '%checklist%'
     OR e.tipo_evento ILIKE '%liberad%'
     OR e.tipo_evento ILIKE '%pagamento%'
     OR e.tipo_evento ILIKE '%reaproveit%')

UNION ALL

-- 05 ─ Vendas dele -----------------------------------------------------------
SELECT '05 · VENDAS DELE'::text,
       5,
       ('venda ' || v.id::text || ' (legado ' || COALESCE(v.id_legado::text,'-') || ')')::text,
       jsonb_build_object(
         'venda_id',        v.id,
         'id_legado',       v.id_legado,
         'cliente_id_gravado', v.cliente_id,
         'criada_em',       v.created_at,
         'data_cadastro',   v.data_cadastro,
         'status',          v.status,
         'cobranca_status', v.cobranca_status,
         'cobranca_origem', v.cobranca_origem,
         'origem_proposta', v.origem_proposta,
         'forma_pagamento', v.forma_pagamento,
         'valor_a_pagar',   v.valor_a_pagar,
         'valor_aberto',    v.valor_aberto,
         'valor_total_pago_cliente', v.valor_total_pago_cliente,
         'asaas_payment_id', v.asaas_payment_id,
         'cobranca_gerada_em',     v.cobranca_gerada_em,
         'cobranca_confirmada_em', v.cobranca_confirmada_em,
         'status_validacao_valor', v.status_validacao_valor,
         'aprovado_por',    v.aprovado_por,
         'aprovado_em',     v.aprovado_em
       )
  FROM vend v

UNION ALL

-- 06 ─ Itens de cada venda ---------------------------------------------------
SELECT '06 · ITENS DE CADA VENDA'::text,
       6,
       ('venda ' || iv.venda_id::text || ' · servico ' || COALESCE(iv.servico_id::text,'-'))::text,
       jsonb_build_object(
         'item_id',     iv.id,
         'venda_id',    iv.venda_id,
         'servico_id',  iv.servico_id,
         'servico_nome', (SELECT s.nome_servico FROM public.qa_servicos s WHERE s.id = iv.servico_id),
         'valor',       iv.valor,
         'status',      iv.status,
         'tipo_venda',  iv.tipo_venda,
         'sort_order',  iv.sort_order
       )
  FROM public.qa_itens_venda iv
 WHERE iv.venda_id IN (SELECT id FROM vend)
    OR iv.venda_id IN (SELECT id_legado FROM vend WHERE id_legado IS NOT NULL)

UNION ALL

-- 07 ─ Eventos das vendas (quem abriu cada uma) ------------------------------
SELECT '07 · QUEM ABRIU CADA VENDA'::text,
       7,
       (to_char(ve.created_at, 'DD/MM HH24:MI:SS') || ' · venda ' || ve.venda_id::text)::text,
       jsonb_build_object(
         'venda_id',    ve.venda_id,
         'tipo_evento', ve.tipo_evento,
         'descricao',   ve.descricao,
         'ator',        ve.ator,
         'user_id',     ve.user_id,
         'quando',      ve.created_at,
         'origem',      ve.dados_json ->> 'origem',
         'total',       ve.dados_json ->> 'total',
         'itens',       ve.dados_json -> 'itens'
       )
  FROM public.qa_venda_eventos ve
 WHERE ve.venda_id IN (SELECT id FROM vend)
    OR ve.venda_id IN (SELECT id_legado FROM vend WHERE id_legado IS NOT NULL)

UNION ALL

-- 08 ─ Contratos das vendas --------------------------------------------------
SELECT '08 · CONTRATOS'::text,
       8,
       ('contrato ' || ct.contract_number || ' · venda ' || COALESCE(ct.venda_id::text,'-'))::text,
       jsonb_build_object(
         'contract_id',   ct.id,
         'numero',        ct.contract_number,
         'venda_id',      ct.venda_id,
         'cliente_id',    ct.cliente_id,
         'servico_slug',  ct.servico_slug,
         'status',        ct.status,
         'validation_status', ct.validation_status,
         'valor',         ct.valor,
         'criado_em',     ct.created_at,
         'assinado_empresa_em', ct.company_signed_at,
         'assinatura_cliente_validada_em', ct.customer_signature_validated_at,
         'arquivado_em',  ct.arquivado_em,
         'itens_do_contrato', (SELECT jsonb_agg(jsonb_build_object(
                                  'slug', ci.service_slug_snapshot,
                                  'nome', ci.service_name_snapshot,
                                  'servico_id', ci.service_id_snapshot,
                                  'item_venda_id', ci.item_venda_id))
                                 FROM public.qa_contract_items ci
                                WHERE ci.contract_id = ct.id)
       )
  FROM ctr ct

UNION ALL

-- 09 ─ Eventos dos contratos (a liberação que cria processo) -----------------
SELECT '09 · EVENTOS DOS CONTRATOS'::text,
       9,
       (to_char(ce.created_at, 'DD/MM HH24:MI:SS') || ' · ' || ce.event_type)::text,
       jsonb_build_object(
         'contract_id', ce.contract_id,
         'numero',      (SELECT ct.contract_number FROM ctr ct WHERE ct.id = ce.contract_id),
         'evento',      ce.event_type,
         'quando',      ce.created_at,
         'payload',     ce.event_payload
       )
  FROM public.qa_contract_events ce
 WHERE ce.contract_id IN (SELECT id FROM ctr)

UNION ALL

-- 10 ─ Solicitações de serviço ----------------------------------------------
SELECT '10 · SOLICITAÇÕES DE SERVIÇO'::text,
       10,
       (to_char(so.created_at, 'DD/MM HH24:MI') || ' · ' || so.service_name)::text,
       jsonb_build_object(
         'solicitacao_id', so.id,
         'cliente_id',     so.cliente_id,
         'servico_id',     so.servico_id,
         'slug',           so.service_slug,
         'venda_id',       so.venda_id,
         'item_venda_id',  so.item_venda_id,
         'processo_id',    so.processo_id,
         'origem',         so.origem,
         'status_servico', so.status_servico,
         'status_financeiro', so.status_financeiro,
         'status_processo',   so.status_processo,
         'cadastro_publico_id', so.cadastro_publico_id,
         'arquivado',      so.arquivado,
         'criada_em',      so.created_at
       )
  FROM public.qa_solicitacoes_servico so
 WHERE so.cliente_id IN (SELECT id FROM cli)
    OR so.cliente_id IN (SELECT id_legado FROM cli WHERE id_legado IS NOT NULL)

UNION ALL

-- 11a ─ Webhook do Asaas (o dinheiro de verdade) -----------------------------
SELECT '11 · DINHEIRO — WEBHOOK ASAAS'::text,
       11,
       (to_char(w.created_at, 'DD/MM HH24:MI:SS') || ' · venda ' || COALESCE(w.venda_id::text,'-'))::text,
       jsonb_build_object(
         'venda_id',         w.venda_id,
         'evento',           w.event,
         'asaas_payment_id', w.asaas_payment_id,
         'status',           w.status,
         'recebido_em',      w.created_at,
         'processado_em',    w.processed_at,
         'erro',             w.error_message,
         'valor',            w.payload -> 'payment' ->> 'value'
       )
  FROM public.qa_asaas_webhook_events w
 WHERE w.venda_id IN (SELECT id FROM vend)
    OR w.venda_id IN (SELECT id_legado FROM vend WHERE id_legado IS NOT NULL)

UNION ALL

-- 11b ─ Quem marcou a venda como paga ----------------------------------------
SELECT '11 · DINHEIRO — QUEM MARCOU PAGO'::text,
       12,
       (to_char(pa.created_at, 'DD/MM HH24:MI:SS') || ' · venda ' || COALESCE(pa.venda_id::text,'-'))::text,
       jsonb_build_object(
         'venda_id',  pa.venda_id,
         'campo',     pa.campo,
         'de',        pa.valor_anterior,
         'para',      pa.valor_novo,
         'origem',    pa.origem,
         'ator',      pa.ator,
         'quando',    pa.created_at,
         'contexto',  pa.contexto
       )
  FROM public.qa_pagamento_auditoria pa
 WHERE pa.venda_id IN (SELECT id FROM vend)
    OR pa.venda_id IN (SELECT id_legado FROM vend WHERE id_legado IS NOT NULL)
    OR pa.cliente_id IN (SELECT id FROM cli)
    OR pa.cliente_id IN (SELECT id_legado FROM cli WHERE id_legado IS NOT NULL)

UNION ALL

-- 12 ─ Panorama: outros clientes com processo repetido do mesmo serviço ------
SELECT '12 · BASE INTEIRA — PROCESSO REPETIDO DO MESMO SERVIÇO'::text,
       13,
       (c.nome_completo || ' · ' || p.servico_nome)::text,
       jsonb_build_object(
         'cliente_id',   c.id,
         'servico_id',   p.servico_id,
         'processos',    count(*),
         'vendas_distintas', count(DISTINCT p.venda_id),
         'processos_sem_venda', count(*) FILTER (WHERE p.venda_id IS NULL),
         'ids',          array_agg(p.id ORDER BY p.data_criacao),
         'criados_em',   array_agg(p.data_criacao ORDER BY p.data_criacao),
         'vendas',       array_agg(p.venda_id ORDER BY p.data_criacao),
         'status',       array_agg(p.status ORDER BY p.data_criacao),
         'leitura', CASE
                      WHEN count(*) FILTER (WHERE p.venda_id IS NULL) > 0
                        THEN 'PROCESSO SEM VENDA — nasceu por porta manual/RPC, sem trava'
                      WHEN count(DISTINCT p.venda_id) < count(*)
                        THEN 'MESMA VENDA GEROU MAIS DE UM — falha de idempotência'
                      ELSE 'VENDAS DIFERENTES — contratou/foi cobrado mais de uma vez'
                    END
       )
  FROM public.qa_processos p
  JOIN public.qa_clientes c ON c.id = p.cliente_id
 WHERE p.status NOT IN ('cancelado','arquivado')
 GROUP BY c.id, c.nome_completo, p.servico_id, p.servico_nome
HAVING count(*) > 1

UNION ALL

-- 13 ─ Panorama: processos sem venda (porta sem trava) -----------------------
SELECT '13 · BASE INTEIRA — PROCESSOS SEM VENDA'::text,
       14,
       COALESCE(p.servico_nome, '(sem serviço)')::text,
       jsonb_build_object(
         'processos_sem_venda', count(*),
         'clientes_atingidos',  count(DISTINCT p.cliente_id),
         'mais_antigo',         min(p.data_criacao),
         'mais_recente',        max(p.data_criacao),
         'status',              jsonb_agg(DISTINCT p.status)
       )
  FROM public.qa_processos p
 WHERE p.venda_id IS NULL
   AND p.status NOT IN ('cancelado','arquivado')
 GROUP BY p.servico_nome

 ORDER BY ord, origem;
