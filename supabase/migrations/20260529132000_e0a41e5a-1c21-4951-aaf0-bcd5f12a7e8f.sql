
SELECT set_config('qa.allow_processo_cascade_delete', 'on', true);
SELECT set_config('qa.allow_total_client_delete',     '1',  true);
SELECT set_config('app.allow_venda_evento_delete',    'on', true);
SELECT set_config('app.allow_senha_gov_delete',       'true', true);

DO $$
DECLARE
  v_id integer;
  v_id_legado integer;
  v_venda_ids integer[];
  v_venda_legados integer[];
  v_contract_ids uuid[];
  v_user_ids uuid[];
  v_ids integer[] := ARRAY[150, 130];
BEGIN
  FOREACH v_id IN ARRAY v_ids LOOP
    SELECT COALESCE(id_legado, id) INTO v_id_legado FROM public.qa_clientes WHERE id = v_id;
    IF v_id_legado IS NULL THEN
      RAISE NOTICE 'Cliente % não encontrado, pulando.', v_id;
      CONTINUE;
    END IF;

    SELECT COALESCE(array_agg(user_id), ARRAY[]::uuid[]) INTO v_user_ids
      FROM public.cliente_auth_links WHERE qa_cliente_id = v_id;

    SELECT COALESCE(array_agg(id), ARRAY[]::integer[]),
           COALESCE(array_agg(COALESCE(id_legado, id)), ARRAY[]::integer[])
      INTO v_venda_ids, v_venda_legados
      FROM public.qa_vendas WHERE cliente_id IN (v_id, v_id_legado);

    SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO v_contract_ids
      FROM public.qa_contracts
     WHERE cliente_id IN (v_id, v_id_legado)
        OR venda_id = ANY(v_venda_ids)
        OR venda_id = ANY(v_venda_legados);

    -- Contratos antes de vendas
    IF array_length(v_contract_ids, 1) IS NOT NULL THEN
      DELETE FROM public.qa_contract_events     WHERE contract_id = ANY(v_contract_ids);
      DELETE FROM public.qa_contract_signatures WHERE contract_id = ANY(v_contract_ids);
      DELETE FROM public.qa_contract_items      WHERE contract_id = ANY(v_contract_ids);
      DELETE FROM public.qa_contracts           WHERE id = ANY(v_contract_ids);
    END IF;
    DELETE FROM public.qa_contract_aceites_log WHERE cliente_id IN (v_id, v_id_legado);

    -- Vendas filhas
    IF array_length(v_venda_ids, 1) IS NOT NULL THEN
      DELETE FROM public.qa_itens_venda WHERE venda_id = ANY(v_venda_ids) OR venda_id = ANY(v_venda_legados);
      DELETE FROM public.qa_venda_eventos WHERE venda_id = ANY(v_venda_ids);
      DELETE FROM public.qa_pagamento_auditoria WHERE venda_id = ANY(v_venda_ids);
    END IF;

    -- Processos
    DELETE FROM public.qa_processo_documentos WHERE cliente_id = v_id;
    DELETE FROM public.qa_processos WHERE cliente_id IN (v_id, v_id_legado);
    DELETE FROM public.qa_vendas WHERE cliente_id IN (v_id, v_id_legado);

    -- Solicitações
    DELETE FROM public.qa_status_eventos
     WHERE cliente_id = v_id
        OR solicitacao_id IN (SELECT id FROM public.qa_solicitacoes_servico WHERE cliente_id = v_id);
    DELETE FROM public.qa_solicitacao_eventos WHERE cliente_id = v_id;
    DELETE FROM public.qa_solicitacoes_servico WHERE cliente_id = v_id;

    -- Armas / Munição
    DELETE FROM public.qa_arma_gt_declaracoes WHERE qa_cliente_id = v_id;
    DELETE FROM public.qa_cliente_armas_auditoria WHERE qa_cliente_id = v_id;
    DELETE FROM public.qa_cliente_armas_manual WHERE qa_cliente_id = v_id;
    DELETE FROM public.qa_municoes_movimentacoes WHERE cliente_id = v_id;
    DELETE FROM public.qa_municoes WHERE cliente_id = v_id;

    -- Alertas de exames (FK -> qa_exames_cliente) ANTES de qa_exames_cliente
    DELETE FROM public.qa_exames_alertas_enviados
     WHERE exame_id IN (SELECT id FROM public.qa_exames_cliente WHERE cliente_id = v_id);
    DELETE FROM public.qa_exames_cliente WHERE cliente_id = v_id;

    DELETE FROM public.qa_cadastro_cr WHERE cliente_id = v_id;
    DELETE FROM public.qa_crafs WHERE cliente_id = v_id;
    DELETE FROM public.qa_gte_alertas_enviados WHERE cliente_id = v_id;
    DELETE FROM public.qa_gte_documentos WHERE cliente_id = v_id;
    DELETE FROM public.qa_gtes WHERE cliente_id = v_id;
    DELETE FROM public.qa_filiacoes WHERE cliente_id = v_id;
    DELETE FROM public.qa_terceiros WHERE cliente_id = v_id;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='qa_protocolos') THEN
      EXECUTE 'DELETE FROM public.qa_protocolos WHERE qa_cliente_id = $1' USING v_id;
    END IF;

    DELETE FROM public.qa_ia_correcoes_juridicas WHERE cliente_id = v_id;
    DELETE FROM public.qa_geracoes_pecas WHERE cliente_id = v_id;
    DELETE FROM public.qa_casos WHERE cliente_id = v_id;
    DELETE FROM public.qa_arsenal_notificacoes WHERE cliente_id = v_id;
    DELETE FROM public.qa_arsenal_grupos_layout WHERE cliente_id = v_id;
    DELETE FROM public.qa_cliente_kpi_layouts WHERE cliente_id = v_id;
    DELETE FROM public.qa_dashboard_kpi_layout WHERE cliente_id = v_id;

    IF array_length(v_user_ids, 1) IS NOT NULL THEN
      DELETE FROM public.qa_homologacao_sessoes WHERE cliente_id = ANY(v_user_ids);
    END IF;

    DELETE FROM public.qa_cliente_credenciais WHERE cliente_id = v_id;
    DELETE FROM public.qa_cliente_credenciais_audit WHERE cliente_id = v_id;
    DELETE FROM public.qa_senha_gov_acessos WHERE cliente_id = v_id;

    DELETE FROM public.qa_processos_alertas_enviados WHERE cliente_id = v_id;
    DELETE FROM public.qa_vencimentos_alertas_enviados WHERE cliente_id = v_id;
    DELETE FROM public.qa_cliente_historico_atualizacoes WHERE cliente_id = v_id;

    DELETE FROM public.cliente_auth_links WHERE qa_cliente_id = v_id;
    DELETE FROM public.qa_documentos_cliente WHERE qa_cliente_id = v_id;
    DELETE FROM public.qa_cadastro_publico WHERE cliente_id_vinculado = v_id;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='qa_asaas_cobrancas') THEN
      EXECUTE 'DELETE FROM public.qa_asaas_cobrancas WHERE cliente_id IN ($1, $2)' USING v_id, v_id_legado;
    END IF;

    DELETE FROM public.qa_clientes WHERE id = v_id;
    RAISE NOTICE 'Cliente % (Willian) excluído com sucesso.', v_id;
  END LOOP;
END $$;

SELECT set_config('qa.allow_processo_cascade_delete', 'off', true);
SELECT set_config('qa.allow_total_client_delete',     '0',   true);
SELECT set_config('app.allow_venda_evento_delete',    'off', true);
SELECT set_config('app.allow_senha_gov_delete',       'false', true);

INSERT INTO public.qa_logs_auditoria (entidade, entidade_id, acao, detalhes_json, created_at)
SELECT 'qa_clientes', NULL, 'HOMOLOG_CLEANUP',
       jsonb_build_object(
         'clientes_removidos', ARRAY[150, 130],
         'motivo', 'Limpeza pós-ciclo de auditoria QA 2026-05-29.',
         'tag', 'HOMOLOG_CLEANUP_20260529'
       ),
       now();
