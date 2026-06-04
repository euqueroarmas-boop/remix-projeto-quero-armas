CREATE OR REPLACE FUNCTION public.qa_cliente_armas_audit_imutavel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF current_setting('qa.allow_total_client_delete', true) = '1' AND TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'qa_cliente_armas_auditoria é imutável (acao=%).', TG_OP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.qa_cadastro_cr_audit_imutavel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF current_setting('qa.allow_total_client_delete', true) = '1' AND TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'qa_cadastro_cr_audit eh imutavel.';
END;
$function$;

CREATE OR REPLACE FUNCTION public.qa_munmov_before_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  saldo_apos integer;
BEGIN
  IF current_setting('qa.allow_total_client_delete', true) = '1' THEN
    RETURN OLD;
  END IF;

  IF OLD.tipo = 'ENTRADA' THEN
    SELECT COALESCE(SUM(CASE tipo WHEN 'ENTRADA' THEN quantidade ELSE -quantidade END), 0)
      INTO saldo_apos
      FROM public.qa_municoes_movimentacoes
     WHERE cliente_id = OLD.cliente_id
       AND calibre    = OLD.calibre
       AND COALESCE(marca,'') = COALESCE(OLD.marca,'')
       AND COALESCE(lote, '') = COALESCE(OLD.lote, '')
       AND id <> OLD.id;
    IF saldo_apos < 0 THEN
      RAISE EXCEPTION 'Não é possível remover esta entrada: deixaria saldo negativo (% após exclusão).', saldo_apos
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN OLD;
END;
$function$;

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
  v_venda_ids integer[] := ARRAY[]::integer[];
  v_venda_legado_ids integer[] := ARRAY[]::integer[];
  v_contract_ids uuid[] := ARRAY[]::uuid[];
  v_processo_ids uuid[] := ARRAY[]::uuid[];
  v_solicitacao_ids uuid[] := ARRAY[]::uuid[];
  v_cadastro_cr_ids integer[] := ARRAY[]::integer[];
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
  PERFORM set_config('qa.allow_processo_cascade_delete', 'on', true);

  SELECT COALESCE(array_agg(id), ARRAY[]::integer[]), COALESCE(array_agg(id_legado), ARRAY[]::integer[])
    INTO v_venda_ids, v_venda_legado_ids
    FROM public.qa_vendas
   WHERE cliente_id = v_id_legado OR cliente_id = p_cliente_id;

  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[])
    INTO v_contract_ids
    FROM public.qa_contracts
   WHERE cliente_id = v_id_legado
      OR cliente_id = p_cliente_id
      OR venda_id = ANY(v_venda_ids)
      OR venda_id = ANY(v_venda_legado_ids);

  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[])
    INTO v_processo_ids
    FROM public.qa_processos
   WHERE cliente_id = p_cliente_id
      OR venda_id = ANY(v_venda_ids)
      OR venda_id = ANY(v_venda_legado_ids);

  SELECT COALESCE(array_agg(id), ARRAY[]::integer[])
    INTO v_cadastro_cr_ids
    FROM public.qa_cadastro_cr
   WHERE cliente_id = p_cliente_id;

  IF to_regclass('public.qa_solicitacoes_servico') IS NOT NULL THEN
    EXECUTE 'SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) FROM public.qa_solicitacoes_servico WHERE cliente_id = $1'
      INTO v_solicitacao_ids
      USING p_cliente_id;
  END IF;

  IF cardinality(v_venda_ids) > 0 OR cardinality(v_venda_legado_ids) > 0 THEN
    IF to_regclass('public.qa_homologacao_sessoes') IS NOT NULL THEN
      DELETE FROM public.qa_homologacao_sessoes WHERE venda_id = ANY(v_venda_ids) OR venda_id = ANY(v_venda_legado_ids);
    END IF;

    IF to_regclass('public.qa_homologacao_logs') IS NOT NULL
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='qa_homologacao_logs' AND column_name='venda_id') THEN
      EXECUTE 'DELETE FROM public.qa_homologacao_logs WHERE venda_id = ANY($1) OR venda_id = ANY($2)'
      USING v_venda_ids, v_venda_legado_ids;
    END IF;

    DELETE FROM public.qa_venda_eventos WHERE venda_id = ANY(v_venda_ids) OR venda_id = ANY(v_venda_legado_ids) OR cliente_id = p_cliente_id OR qa_cliente_id = p_cliente_id;
    DELETE FROM public.qa_itens_venda WHERE venda_id = ANY(v_venda_ids) OR venda_id = ANY(v_venda_legado_ids);

    IF to_regclass('public.qa_pagamento_auditoria') IS NOT NULL THEN
      DELETE FROM public.qa_pagamento_auditoria WHERE venda_id = ANY(v_venda_ids) OR venda_id = ANY(v_venda_legado_ids) OR cliente_id = p_cliente_id;
    END IF;

    IF to_regclass('public.qa_asaas_cobrancas') IS NOT NULL THEN
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='qa_asaas_cobrancas' AND column_name='venda_id') THEN
        EXECUTE 'DELETE FROM public.qa_asaas_cobrancas WHERE venda_id = ANY($1) OR venda_id = ANY($2)'
        USING v_venda_ids, v_venda_legado_ids;
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='qa_asaas_cobrancas' AND column_name='cliente_id') THEN
        EXECUTE 'DELETE FROM public.qa_asaas_cobrancas WHERE cliente_id = $1 OR cliente_id = $2'
        USING p_cliente_id, v_id_legado;
      END IF;
    END IF;
  END IF;

  IF to_regclass('public.qa_asaas_webhook_events') IS NOT NULL THEN
    DELETE FROM public.qa_asaas_webhook_events WHERE venda_id = ANY(v_venda_ids) OR venda_id = ANY(v_venda_legado_ids);
  END IF;

  DELETE FROM public.qa_contract_aceites_log WHERE contract_id = ANY(v_contract_ids) OR cliente_id = p_cliente_id OR cliente_id = v_id_legado;
  DELETE FROM public.qa_contract_events WHERE contract_id = ANY(v_contract_ids);
  DELETE FROM public.qa_contract_signatures WHERE contract_id = ANY(v_contract_ids);
  DELETE FROM public.qa_contract_items WHERE contract_id = ANY(v_contract_ids) OR venda_id = ANY(v_venda_ids) OR venda_id = ANY(v_venda_legado_ids);
  DELETE FROM public.qa_contracts WHERE id = ANY(v_contract_ids) OR cliente_id = p_cliente_id OR cliente_id = v_id_legado OR venda_id = ANY(v_venda_ids) OR venda_id = ANY(v_venda_legado_ids);

  IF to_regclass('public.qa_status_eventos') IS NOT NULL THEN
    DELETE FROM public.qa_status_eventos WHERE cliente_id = p_cliente_id OR solicitacao_id = ANY(v_solicitacao_ids) OR processo_id = ANY(v_processo_ids);
  END IF;
  IF to_regclass('public.qa_solicitacao_eventos') IS NOT NULL THEN
    DELETE FROM public.qa_solicitacao_eventos WHERE cliente_id = p_cliente_id OR solicitacao_id = ANY(v_solicitacao_ids);
  END IF;
  IF to_regclass('public.qa_solicitacoes_servico') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.qa_solicitacoes_servico WHERE cliente_id = $1 OR id = ANY($2)'
    USING p_cliente_id, v_solicitacao_ids;
  END IF;

  IF to_regclass('public.qa_processos_alertas_enviados') IS NOT NULL THEN
    DELETE FROM public.qa_processos_alertas_enviados WHERE cliente_id = p_cliente_id OR processo_id = ANY(v_processo_ids);
  END IF;
  DELETE FROM public.qa_processo_eventos WHERE processo_id = ANY(v_processo_ids);
  DELETE FROM public.qa_processo_documentos WHERE processo_id = ANY(v_processo_ids) OR cliente_id = p_cliente_id;
  DELETE FROM public.qa_processos WHERE id = ANY(v_processo_ids) OR cliente_id = p_cliente_id;

  DELETE FROM public.qa_arma_gt_declaracoes WHERE qa_cliente_id = p_cliente_id;
  DELETE FROM public.qa_cliente_armas_auditoria WHERE qa_cliente_id = p_cliente_id;
  DELETE FROM public.qa_cliente_armas_manual WHERE qa_cliente_id = p_cliente_id;

  DELETE FROM public.qa_municoes_movimentacoes WHERE cliente_id = p_cliente_id;
  DELETE FROM public.qa_municoes WHERE cliente_id = p_cliente_id;

  DELETE FROM public.qa_exames_cliente WHERE cliente_id = p_cliente_id;
  DELETE FROM public.qa_cliente_credenciais WHERE cliente_id = p_cliente_id OR cadastro_cr_id = ANY(v_cadastro_cr_ids);
  DELETE FROM public.qa_senha_gov_acessos WHERE cliente_id = p_cliente_id OR cadastro_cr_id = ANY(v_cadastro_cr_ids);
  IF to_regclass('public.qa_cadastro_cr_audit') IS NOT NULL THEN
    DELETE FROM public.qa_cadastro_cr_audit WHERE cadastro_cr_id = ANY(v_cadastro_cr_ids) OR cliente_id_anterior = p_cliente_id OR cliente_id_novo = p_cliente_id;
  END IF;
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
  IF to_regclass('public.qa_cliente_credenciais_audit') IS NOT NULL THEN
    DELETE FROM public.qa_cliente_credenciais_audit WHERE cliente_id = p_cliente_id;
  END IF;
  DELETE FROM public.qa_cliente_historico_atualizacoes WHERE cliente_id = p_cliente_id;
  DELETE FROM public.qa_vencimentos_alertas_enviados WHERE cliente_id = p_cliente_id;
  DELETE FROM public.cliente_auth_links WHERE qa_cliente_id = p_cliente_id;
  DELETE FROM public.qa_cadastro_publico WHERE cliente_id_vinculado = p_cliente_id;
  DELETE FROM public.qa_documentos_cliente WHERE qa_cliente_id = p_cliente_id;

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

  DELETE FROM public.qa_vendas WHERE cliente_id = v_id_legado OR cliente_id = p_cliente_id OR id = ANY(v_venda_ids) OR id_legado = ANY(v_venda_legado_ids);
  DELETE FROM public.qa_clientes WHERE id = p_cliente_id;

  PERFORM set_config('qa.allow_processo_cascade_delete', 'off', true);
  RETURN jsonb_build_object('ok', true, 'deleted_cliente_id', p_cliente_id, 'deleted_nome', v_nome);
END;
$function$;