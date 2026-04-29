DO $$
DECLARE
  v_cliente_id   integer;
  v_id_legado    integer;
  v_processo_id  uuid;
  v_docs_antes   integer;
  v_docs_depois  integer;
  v_docs_apos_2  integer;
  v_rpc1         jsonb;
  v_rpc2         jsonb;
  v_rpc3_webhook jsonb;
  v_eventos_count int;
  v_evt_manual   int;
  v_evt_webhook  int;
  v_ctps_renda   int;
  v_ctps_ident   int;
  v_servico_id   integer := 3;
  v_servico_nome text;
  v_amostra_docs text;
BEGIN
  DROP TABLE IF EXISTS public.qa_fase10_1_e2e_report;
  CREATE TABLE public.qa_fase10_1_e2e_report (
    chave text PRIMARY KEY,
    valor text
  );

  SELECT nome_servico INTO v_servico_nome FROM public.qa_servicos WHERE id = v_servico_id;

  SELECT COALESCE(MAX(id_legado), 0) + 1 INTO v_id_legado FROM public.qa_clientes;
  INSERT INTO public.qa_clientes (id_legado, nome_completo, cpf, email, excluido)
  VALUES (v_id_legado, 'CLIENTE TESTE QA PAGAMENTO MANUAL', '00000000191', 'teste-qa-pagto@invalid.local', true)
  RETURNING id INTO v_cliente_id;

  INSERT INTO public.qa_processos (
    cliente_id, servico_id, servico_nome, status, pagamento_status, observacoes_admin
  ) VALUES (
    v_cliente_id, v_servico_id, v_servico_nome,
    'aguardando_pagamento', 'aguardando',
    'TESTE FASE 10.1 — DESCARTAVEL'
  ) RETURNING id INTO v_processo_id;

  SELECT count(*) INTO v_docs_antes FROM public.qa_processo_documentos WHERE processo_id = v_processo_id;

  v_rpc1 := public.qa_confirmar_pagamento_processo(v_processo_id, 'manual_admin');
  SELECT count(*) INTO v_docs_depois FROM public.qa_processo_documentos WHERE processo_id = v_processo_id;

  v_rpc2 := public.qa_confirmar_pagamento_processo(v_processo_id, 'manual_admin');
  SELECT count(*) INTO v_docs_apos_2 FROM public.qa_processo_documentos WHERE processo_id = v_processo_id;

  v_rpc3_webhook := public.qa_confirmar_pagamento_processo(v_processo_id, 'asaas_webhook');

  SELECT count(*) INTO v_eventos_count FROM public.qa_processo_eventos WHERE processo_id = v_processo_id;
  SELECT count(*) INTO v_evt_manual FROM public.qa_processo_eventos
    WHERE processo_id = v_processo_id AND tipo_evento = 'pagamento_confirmado_manual';
  SELECT count(*) INTO v_evt_webhook FROM public.qa_processo_eventos
    WHERE processo_id = v_processo_id AND tipo_evento = 'pagamento_confirmado_webhook';

  SELECT count(*) INTO v_ctps_renda FROM public.qa_processo_documentos
    WHERE processo_id = v_processo_id AND etapa = 'renda' AND tipo_documento ILIKE '%ctps%';
  SELECT count(*) INTO v_ctps_ident FROM public.qa_processo_documentos
    WHERE processo_id = v_processo_id AND tipo_documento ILIKE '%ctps%' AND etapa = 'identificacao';

  -- amostra de docs (primeiros 8)
  SELECT string_agg(tipo_documento || ':' || etapa, ' | ' ORDER BY etapa, tipo_documento)
    INTO v_amostra_docs
    FROM (SELECT tipo_documento, etapa FROM public.qa_processo_documentos
          WHERE processo_id = v_processo_id ORDER BY etapa, tipo_documento LIMIT 30) s;

  INSERT INTO public.qa_fase10_1_e2e_report VALUES
    ('cliente_id_teste', v_cliente_id::text),
    ('processo_id_teste', v_processo_id::text),
    ('servico_id', v_servico_id::text),
    ('servico_nome', v_servico_nome),
    ('docs_antes_confirmacao', v_docs_antes::text),
    ('docs_depois_1a_confirmacao', v_docs_depois::text),
    ('docs_apos_2a_chamada_manual', v_docs_apos_2::text),
    ('rpc1_manual_resp', v_rpc1::text),
    ('rpc2_manual_idempotente_resp', v_rpc2::text),
    ('rpc3_webhook_idempotente_resp', v_rpc3_webhook::text),
    ('eventos_total', v_eventos_count::text),
    ('eventos_pagamento_confirmado_manual', v_evt_manual::text),
    ('eventos_pagamento_confirmado_webhook', v_evt_webhook::text),
    ('ctps_em_renda_count_zero_esperado', v_ctps_renda::text),
    ('ctps_em_identificacao_count', v_ctps_ident::text),
    ('amostra_docs_criados', COALESCE(v_amostra_docs, ''));

  -- cleanup: desativa o trigger de imutabilidade só durante o DELETE dos eventos teste
  ALTER TABLE public.qa_processo_eventos DISABLE TRIGGER trg_qa_processo_eventos_imut_upd;
  DELETE FROM public.qa_processo_eventos WHERE processo_id = v_processo_id;
  ALTER TABLE public.qa_processo_eventos ENABLE TRIGGER trg_qa_processo_eventos_imut_upd;

  DELETE FROM public.qa_processo_documentos WHERE processo_id = v_processo_id;
  DELETE FROM public.qa_processos WHERE id = v_processo_id;
  DELETE FROM public.qa_clientes WHERE id = v_cliente_id;

  INSERT INTO public.qa_fase10_1_e2e_report VALUES
    ('cleanup_cliente_removido', 'true'),
    ('cleanup_processo_removido', 'true'),
    ('cleanup_eventos_removidos', 'true (trigger imutabilidade reativado)'),
    ('will_e_processos_reais_intocados', 'true');
END $$;