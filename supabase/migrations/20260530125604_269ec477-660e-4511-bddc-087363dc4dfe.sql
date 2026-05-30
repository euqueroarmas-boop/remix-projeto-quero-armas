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
  v_cpf text;
  v_email text;
  v_cpf_norm text;
  v_email_norm text;
  v_venda_ids integer[];
  v_venda_legado_ids integer[];
BEGIN
  IF NOT public.qa_is_active_staff(v_uid) THEN
    RAISE EXCEPTION 'Sem permissão para excluir cliente definitivamente';
  END IF;

  SELECT id_legado, COALESCE(arquivado,false), nome_completo, cpf, email
    INTO v_id_legado, v_arquivado, v_nome, v_cpf, v_email
    FROM public.qa_clientes
   WHERE id = p_cliente_id;

  IF v_nome IS NULL THEN
    RAISE EXCEPTION 'Cliente % não encontrado', p_cliente_id;
  END IF;

  IF NOT v_arquivado THEN
    RAISE EXCEPTION 'Cliente precisa estar ARQUIVADO antes da exclusão definitiva. Arquive primeiro.';
  END IF;

  v_cpf_norm := regexp_replace(coalesce(v_cpf, ''), '\D', '', 'g');
  v_email_norm := lower(trim(coalesce(v_email, '')));

  PERFORM set_config('qa.allow_total_client_delete', '1', true);

  SELECT COALESCE(array_agg(id), ARRAY[]::integer[]), COALESCE(array_agg(id_legado), ARRAY[]::integer[])
    INTO v_venda_ids, v_venda_legado_ids
    FROM public.qa_vendas
   WHERE cliente_id = v_id_legado OR cliente_id = p_cliente_id;

  IF array_length(v_venda_ids, 1) IS NOT NULL THEN
    DELETE FROM public.qa_homologacao_sessoes WHERE venda_id = ANY(v_venda_ids) OR venda_id = ANY(v_venda_legado_ids);

    IF to_regclass('public.qa_homologacao_logs') IS NOT NULL THEN
      EXECUTE 'DELETE FROM public.qa_homologacao_logs WHERE venda_id = ANY($1) OR venda_id = ANY($2)'
      USING v_venda_ids, v_venda_legado_ids;
    END IF;

    DELETE FROM public.qa_venda_eventos WHERE venda_id = ANY(v_venda_ids) OR venda_id = ANY(v_venda_legado_ids);
    DELETE FROM public.qa_itens_venda WHERE venda_id = ANY(v_venda_ids) OR venda_id = ANY(v_venda_legado_ids);
    DELETE FROM public.qa_contract_aceites_log WHERE venda_id = ANY(v_venda_ids) OR venda_id = ANY(v_venda_legado_ids);
    DELETE FROM public.qa_contract_events WHERE contract_id IN (SELECT id FROM public.qa_contracts WHERE venda_id = ANY(v_venda_ids) OR venda_id = ANY(v_venda_legado_ids));
    DELETE FROM public.qa_contract_signatures WHERE contract_id IN (SELECT id FROM public.qa_contracts WHERE venda_id = ANY(v_venda_ids) OR venda_id = ANY(v_venda_legado_ids));
    DELETE FROM public.qa_contract_items WHERE contract_id IN (SELECT id FROM public.qa_contracts WHERE venda_id = ANY(v_venda_ids) OR venda_id = ANY(v_venda_legado_ids));
    DELETE FROM public.qa_contracts WHERE venda_id = ANY(v_venda_ids) OR venda_id = ANY(v_venda_legado_ids);
    DELETE FROM public.qa_asaas_cobrancas WHERE venda_id = ANY(v_venda_ids) OR venda_id = ANY(v_venda_legado_ids);
  END IF;

  DELETE FROM public.qa_vendas WHERE cliente_id = v_id_legado OR cliente_id = p_cliente_id;

  DELETE FROM public.qa_arma_gt_declaracoes WHERE cliente_id = p_cliente_id;
  DELETE FROM public.qa_cliente_armas_auditoria WHERE cliente_id = p_cliente_id;
  DELETE FROM public.qa_cliente_armas_manual WHERE cliente_id = p_cliente_id;
  DELETE FROM public.qa_municoes_movimentacoes WHERE municao_id IN (SELECT id FROM public.qa_municoes WHERE cliente_id = p_cliente_id);
  DELETE FROM public.qa_municoes WHERE cliente_id = p_cliente_id;
  DELETE FROM public.qa_exames_cliente WHERE cliente_id = p_cliente_id;
  DELETE FROM public.qa_cadastro_cr WHERE cliente_id = p_cliente_id;
  DELETE FROM public.qa_crafs WHERE cliente_id = p_cliente_id;
  DELETE FROM public.qa_gte_alertas_enviados WHERE gte_id IN (SELECT id FROM public.qa_gtes WHERE cliente_id = p_cliente_id);
  DELETE FROM public.qa_gte_documentos WHERE gte_id IN (SELECT id FROM public.qa_gtes WHERE cliente_id = p_cliente_id);
  DELETE FROM public.qa_gtes WHERE cliente_id = p_cliente_id;
  DELETE FROM public.qa_filiacoes WHERE cliente_id = p_cliente_id;
  DELETE FROM public.qa_terceiros WHERE cliente_id = p_cliente_id;
  DELETE FROM public.qa_protocolos WHERE cliente_id = p_cliente_id;

  DELETE FROM public.qa_ia_correcoes_juridicas WHERE geracao_id IN (SELECT id FROM public.qa_geracoes_pecas WHERE cliente_id = p_cliente_id);
  DELETE FROM public.qa_geracoes_pecas WHERE cliente_id = p_cliente_id;
  DELETE FROM public.qa_casos WHERE cliente_id = p_cliente_id;

  DELETE FROM public.qa_processo_eventos WHERE processo_id IN (SELECT id FROM public.qa_processos WHERE cliente_id = p_cliente_id);
  DELETE FROM public.qa_processo_documentos WHERE processo_id IN (SELECT id FROM public.qa_processos WHERE cliente_id = p_cliente_id);
  DELETE FROM public.qa_processos WHERE cliente_id = p_cliente_id;

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
  DELETE FROM public.qa_documentos_cliente WHERE cliente_id = p_cliente_id;

  IF v_cpf_norm <> '' THEN
    DELETE FROM public.qa_cadastro_publico
     WHERE regexp_replace(coalesce(cpf, ''), '\D', '', 'g') = v_cpf_norm;
  END IF;

  IF v_email_norm <> '' THEN
    DELETE FROM public.qa_cadastro_publico
     WHERE lower(trim(coalesce(email, ''))) = v_email_norm;
    DELETE FROM public.cliente_auth_links
     WHERE lower(trim(coalesce(email, ''))) = v_email_norm;
  END IF;

  DELETE FROM public.qa_clientes WHERE id = p_cliente_id;

  RETURN jsonb_build_object('ok', true, 'deleted_cliente_id', p_cliente_id, 'deleted_nome', v_nome);
END;
$function$;