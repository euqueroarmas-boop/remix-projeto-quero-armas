-- Permite DELETE em qa_processo_eventos quando a exclusão definitiva do cliente
-- está em curso (qa.allow_total_client_delete = '1' setado em qa_cliente_excluir_total_v2).
-- Mantém imutabilidade em todos os outros casos.
CREATE OR REPLACE FUNCTION public.qa_processo_eventos_imutavel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_allow text;
BEGIN
  BEGIN
    v_allow := current_setting('qa.allow_total_client_delete', true);
  EXCEPTION WHEN OTHERS THEN
    v_allow := NULL;
  END;

  IF TG_OP = 'DELETE' THEN
    IF v_allow = '1' THEN
      RETURN OLD; -- libera DELETE durante exclusão definitiva do cliente
    END IF;
    RAISE EXCEPTION 'qa_processo_eventos é imutável (DELETE bloqueado).';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF v_allow = '1' THEN
      RETURN NEW;
    END IF;
    -- UPDATE permitido apenas para SET NULL automático da FK documento_id
    IF NEW.documento_id IS NULL
       AND OLD.documento_id IS NOT NULL
       AND NEW.id              IS NOT DISTINCT FROM OLD.id
       AND NEW.processo_id     IS NOT DISTINCT FROM OLD.processo_id
       AND NEW.tipo_evento     IS NOT DISTINCT FROM OLD.tipo_evento
       AND NEW.descricao       IS NOT DISTINCT FROM OLD.descricao
       AND NEW.dados_json      IS NOT DISTINCT FROM OLD.dados_json
       AND NEW.ator            IS NOT DISTINCT FROM OLD.ator
       AND NEW.user_id         IS NOT DISTINCT FROM OLD.user_id
       AND NEW.created_at      IS NOT DISTINCT FROM OLD.created_at
    THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'qa_processo_eventos é imutável (UPDATE bloqueado em colunas críticas).';
  END IF;
  RETURN NULL;
END;
$$;

-- Também atualiza a função de exclusão definitiva para apagar os eventos
-- explicitamente antes de remover os processos (defensivo + idempotente).
CREATE OR REPLACE FUNCTION public.qa_cliente_excluir_total_v2(p_cliente_id integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_id_legado integer;
  v_arquivado boolean;
  v_nome text;
  v_venda_ids integer[];
  v_venda_legado_ids integer[];
BEGIN
  IF NOT public.qa_is_active_staff(v_uid) THEN
    RAISE EXCEPTION 'Sem permissão para excluir cliente definitivamente';
  END IF;

  SELECT id_legado, COALESCE(arquivado,false), nome_completo
    INTO v_id_legado, v_arquivado, v_nome
    FROM public.qa_clientes
   WHERE id = p_cliente_id;

  IF v_nome IS NULL THEN
    RAISE EXCEPTION 'Cliente % não encontrado', p_cliente_id;
  END IF;

  IF NOT v_arquivado THEN
    RAISE EXCEPTION 'Cliente precisa estar ARQUIVADO antes da exclusão definitiva. Arquive primeiro.';
  END IF;

  PERFORM set_config('qa.allow_total_client_delete', '1', true);

  SELECT COALESCE(array_agg(id), ARRAY[]::integer[]), COALESCE(array_agg(id_legado), ARRAY[]::integer[])
    INTO v_venda_ids, v_venda_legado_ids
    FROM public.qa_vendas
   WHERE cliente_id = v_id_legado OR cliente_id = p_cliente_id;

  IF array_length(v_venda_ids, 1) IS NOT NULL THEN
    DELETE FROM public.qa_homologacao_sessoes WHERE venda_id = ANY(v_venda_ids) OR venda_id = ANY(v_venda_legado_ids);
    DELETE FROM public.qa_itens_venda WHERE venda_id = ANY(v_venda_ids) OR venda_id = ANY(v_venda_legado_ids);
    DELETE FROM public.qa_venda_eventos WHERE venda_id = ANY(v_venda_ids);
    DELETE FROM public.qa_pagamento_auditoria WHERE venda_id = ANY(v_venda_ids);
  END IF;

  DELETE FROM public.qa_status_eventos WHERE cliente_id = p_cliente_id OR solicitacao_id IN (SELECT id FROM public.qa_solicitacoes_servico WHERE cliente_id = p_cliente_id);
  DELETE FROM public.qa_solicitacao_eventos WHERE cliente_id = p_cliente_id;
  DELETE FROM public.qa_solicitacoes_servico WHERE cliente_id = p_cliente_id;

  DELETE FROM public.qa_processos_alertas_enviados WHERE cliente_id = p_cliente_id;
  DELETE FROM public.qa_processo_eventos
    WHERE processo_id IN (SELECT id FROM public.qa_processos WHERE cliente_id = p_cliente_id);
  DELETE FROM public.qa_processo_documentos WHERE cliente_id = p_cliente_id;
  DELETE FROM public.qa_processos WHERE cliente_id = p_cliente_id;

  DELETE FROM public.qa_contract_aceites_log WHERE cliente_id = p_cliente_id OR cliente_id = v_id_legado;
  DELETE FROM public.qa_contract_events WHERE contract_id IN (SELECT id FROM public.qa_contracts WHERE cliente_id = v_id_legado);
  DELETE FROM public.qa_contract_signatures WHERE contract_id IN (SELECT id FROM public.qa_contracts WHERE cliente_id = v_id_legado);
  DELETE FROM public.qa_contract_items WHERE contract_id IN (SELECT id FROM public.qa_contracts WHERE cliente_id = v_id_legado);
  DELETE FROM public.qa_contracts WHERE cliente_id = v_id_legado;

  PERFORM 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='qa_asaas_cobrancas';
  IF FOUND THEN
    EXECUTE 'DELETE FROM public.qa_asaas_cobrancas WHERE cliente_id = $1 OR cliente_id = $2' USING p_cliente_id, v_id_legado;
  END IF;

  DELETE FROM public.qa_vendas WHERE cliente_id = v_id_legado OR cliente_id = p_cliente_id;

  DELETE FROM public.qa_arma_gt_declaracoes WHERE qa_cliente_id = p_cliente_id;
  DELETE FROM public.qa_cliente_armas_auditoria WHERE qa_cliente_id = p_cliente_id;
  DELETE FROM public.qa_cliente_armas_manual WHERE qa_cliente_id = p_cliente_id;

  DELETE FROM public.qa_municoes_movimentacoes WHERE cliente_id = p_cliente_id;
  DELETE FROM public.qa_municoes WHERE cliente_id = p_cliente_id;

  DELETE FROM public.qa_exames_cliente WHERE cliente_id = p_cliente_id;
  DELETE FROM public.qa_cadastro_cr WHERE cliente_id = p_cliente_id;
  DELETE FROM public.qa_crafs WHERE cliente_id = p_cliente_id;
  DELETE FROM public.qa_gte_alertas_enviados WHERE cliente_id = p_cliente_id;
  DELETE FROM public.qa_gte_documentos WHERE cliente_id = p_cliente_id;
  DELETE FROM public.qa_gtes WHERE cliente_id = p_cliente_id;
  DELETE FROM public.qa_filiacoes WHERE cliente_id = p_cliente_id;
  DELETE FROM public.qa_terceiros WHERE cliente_id = p_cliente_id;
  DELETE FROM public.qa_protocolos WHERE qa_cliente_id = p_cliente_id;

  DELETE FROM public.qa_ia_correcoes_juridicas WHERE cliente_id = p_cliente_id;
  DELETE FROM public.qa_geracoes_pecas WHERE cliente_id = p_cliente_id;
  DELETE FROM public.qa_casos WHERE cliente_id = p_cliente_id;

  DELETE FROM public.qa_arsenal_notificacoes WHERE cliente_id = p_cliente_id;
  DELETE FROM public.qa_arsenal_grupos_layout WHERE cliente_id = p_cliente_id;
  DELETE FROM public.qa_cliente_kpi_layouts WHERE cliente_id = p_cliente_id;
  DELETE FROM public.qa_dashboard_kpi_layout WHERE cliente_id = p_cliente_id;

  DELETE FROM public.qa_cliente_credenciais WHERE cliente_id = p_cliente_id;
  DELETE FROM public.qa_senha_gov_acessos WHERE cliente_id = p_cliente_id;

  DELETE FROM public.qa_cliente_historico_atualizacoes WHERE cliente_id = p_cliente_id;
  DELETE FROM public.qa_vencimentos_alertas_enviados WHERE cliente_id = p_cliente_id;

  DELETE FROM public.cliente_auth_links WHERE qa_cliente_id = p_cliente_id;
  DELETE FROM public.qa_cadastro_publico WHERE cliente_id_vinculado = p_cliente_id;
  DELETE FROM public.qa_documentos_cliente WHERE qa_cliente_id = p_cliente_id;
  DELETE FROM public.qa_clientes WHERE id = p_cliente_id;

  RETURN jsonb_build_object('ok', true, 'cliente_id', p_cliente_id, 'nome', v_nome);
END;
$function$;