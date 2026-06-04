CREATE OR REPLACE FUNCTION public.qa_cliente_excluir_total(p_cliente_id integer)
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
BEGIN
  IF NOT public.qa_is_active_staff(v_uid) THEN
    RAISE EXCEPTION 'Sem permissão para excluir cliente definitivamente';
  END IF;

  SELECT id_legado, COALESCE(arquivado,false), nome_completo
    INTO v_id_legado, v_arquivado, v_nome
    FROM public.qa_clientes WHERE id = p_cliente_id;

  IF v_nome IS NULL THEN
    RAISE EXCEPTION 'Cliente % não encontrado', p_cliente_id;
  END IF;
  IF NOT v_arquivado THEN
    RAISE EXCEPTION 'Cliente precisa estar ARQUIVADO antes da exclusão definitiva. Arquive primeiro.';
  END IF;

  -- Captura ids de venda para limpar itens e eventos por venda_id
  SELECT COALESCE(array_agg(id), ARRAY[]::integer[]) INTO v_venda_ids
    FROM public.qa_vendas
   WHERE cliente_id = v_id_legado OR cliente_id = p_cliente_id;

  -- Limpa itens/eventos atrelados às vendas
  IF array_length(v_venda_ids, 1) IS NOT NULL THEN
    DELETE FROM public.qa_itens_venda WHERE venda_id = ANY(v_venda_ids);
    DELETE FROM public.qa_venda_eventos WHERE venda_id = ANY(v_venda_ids);
    DELETE FROM public.qa_pagamento_auditoria WHERE venda_id = ANY(v_venda_ids);
  END IF;

  -- Solicitações de serviço e eventos
  DELETE FROM public.qa_solicitacao_eventos WHERE cliente_id = p_cliente_id;
  DELETE FROM public.qa_solicitacoes_servico WHERE cliente_id = p_cliente_id;

  -- Processos, alertas e documentos de processos
  DELETE FROM public.qa_processos_alertas_enviados WHERE cliente_id = p_cliente_id;
  DELETE FROM public.qa_processo_documentos WHERE cliente_id = p_cliente_id;
  DELETE FROM public.qa_processos WHERE cliente_id = p_cliente_id;

  -- Contratos / aceites
  DELETE FROM public.qa_contract_aceites_log WHERE cliente_id = p_cliente_id OR cliente_id = v_id_legado;
  DELETE FROM public.qa_contracts WHERE cliente_id = v_id_legado;

  -- Cobranças/asaas (se houver tabela)
  PERFORM 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='qa_asaas_cobrancas';
  IF FOUND THEN EXECUTE 'DELETE FROM public.qa_asaas_cobrancas WHERE cliente_id = $1 OR cliente_id = $2' USING p_cliente_id, v_id_legado; END IF;

  -- Vendas (após itens)
  DELETE FROM public.qa_vendas WHERE cliente_id = v_id_legado OR cliente_id = p_cliente_id;

  -- Documentos / armas / munições
  DELETE FROM public.qa_documentos_cliente WHERE qa_cliente_id = p_cliente_id;
  DELETE FROM public.qa_arma_gt_declaracoes WHERE qa_cliente_id = p_cliente_id;
  DELETE FROM public.qa_cliente_armas WHERE qa_cliente_id = p_cliente_id;
  DELETE FROM public.qa_cliente_armas_manual WHERE qa_cliente_id = p_cliente_id;
  DELETE FROM public.qa_cliente_armas_auditoria WHERE qa_cliente_id = p_cliente_id;
  DELETE FROM public.qa_municoes_movimentacoes WHERE cliente_id = p_cliente_id;
  DELETE FROM public.qa_municoes_saldos WHERE cliente_id = p_cliente_id;
  DELETE FROM public.qa_municoes_em_revisao WHERE cliente_id = p_cliente_id;
  DELETE FROM public.qa_municoes WHERE cliente_id = p_cliente_id;

  -- Exames, CR, CRAFs, GTEs, filiações, terceiros, protocolos
  DELETE FROM public.qa_exames_cliente_status WHERE cliente_id = p_cliente_id;
  DELETE FROM public.qa_exames_cliente WHERE cliente_id = p_cliente_id;
  DELETE FROM public.qa_cadastro_cr WHERE cliente_id = p_cliente_id;
  DELETE FROM public.qa_crafs WHERE cliente_id = p_cliente_id;
  DELETE FROM public.qa_gte_alertas_enviados WHERE cliente_id = p_cliente_id;
  DELETE FROM public.qa_gte_documentos WHERE cliente_id = p_cliente_id;
  DELETE FROM public.qa_gtes WHERE cliente_id = p_cliente_id;
  DELETE FROM public.qa_filiacoes WHERE cliente_id = p_cliente_id;
  DELETE FROM public.qa_terceiros WHERE cliente_id = p_cliente_id;
  DELETE FROM public.qa_protocolos WHERE qa_cliente_id = p_cliente_id;

  -- Casos / IA / geração de peças
  DELETE FROM public.qa_ia_correcoes_juridicas WHERE cliente_id = p_cliente_id;
  DELETE FROM public.qa_geracoes_pecas WHERE cliente_id = p_cliente_id;
  DELETE FROM public.qa_casos WHERE cliente_id = p_cliente_id;

  -- Arsenal e personalizações
  DELETE FROM public.qa_arsenal_notificacoes WHERE cliente_id = p_cliente_id;
  DELETE FROM public.qa_arsenal_fila_revisao WHERE cliente_id = p_cliente_id;
  DELETE FROM public.qa_arsenal_grupos_layout WHERE cliente_id = p_cliente_id;
  DELETE FROM public.qa_cliente_kpi_layouts WHERE cliente_id = p_cliente_id;
  DELETE FROM public.qa_dashboard_kpi_layout WHERE cliente_id = p_cliente_id;
  DELETE FROM public.qa_homologacao_sessoes WHERE cliente_id = p_cliente_id;

  -- Credenciais e senha gov
  DELETE FROM public.qa_cliente_credenciais WHERE cliente_id = p_cliente_id;
  DELETE FROM public.qa_senha_gov_acessos WHERE cliente_id = p_cliente_id;

  -- Status / divergências / histórico / alertas
  DELETE FROM public.qa_status_divergencias WHERE cliente_id = p_cliente_id;
  DELETE FROM public.qa_status_eventos WHERE cliente_id = p_cliente_id;
  DELETE FROM public.qa_cliente_historico_atualizacoes WHERE cliente_id = p_cliente_id;
  DELETE FROM public.qa_vencimentos_alertas_enviados WHERE cliente_id = p_cliente_id;

  -- Vínculos de portal (auth)
  DELETE FROM public.cliente_auth_links WHERE qa_cliente_id = p_cliente_id;

  -- Cadastros públicos (formulários internet) - por vínculo e por contato
  DELETE FROM public.qa_cadastro_publico WHERE cliente_id_vinculado = p_cliente_id;

  -- Por fim, o cliente
  DELETE FROM public.qa_clientes WHERE id = p_cliente_id;

  RETURN jsonb_build_object('ok', true, 'cliente_id', p_cliente_id, 'nome', v_nome);
END;
$function$;

REVOKE ALL ON FUNCTION public.qa_cliente_excluir_total(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.qa_cliente_excluir_total(integer) TO authenticated;