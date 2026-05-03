
CREATE OR REPLACE FUNCTION public._qa_purge_legacy_fase2()
RETURNS TABLE(etapa text, qtd bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_alvos    bigint;
  v_manter   bigint;
  v_total    bigint;
  v_final    bigint;
  v_residuo  bigint;
  v_staging  RECORD;
BEGIN
  -- Bypasses de sessão
  PERFORM set_config('row_security', 'off', true);
  PERFORM set_config('app.allow_venda_evento_delete', 'on', true);
  PERFORM set_config('app.allow_senha_gov_delete', 'true', true);
  PERFORM set_config('qa.allow_processo_cascade_delete', 'on', true);

  -- Alvos
  CREATE TEMP TABLE _lr ON COMMIT DROP AS
  SELECT id, id_legado
  FROM public.qa_clientes
  WHERE COALESCE(origem,'') NOT IN ('app_arsenal_publico','formulario_publico','portal_cliente')
    AND cadastro_publico_id IS NULL;

  SELECT count(*) INTO v_alvos FROM _lr;
  SELECT count(*) INTO v_total FROM public.qa_clientes;
  v_manter := v_total - v_alvos;
  RAISE NOTICE 'PRE-VALIDACAO: total=% manter=% remover=%', v_total, v_manter, v_alvos;
  IF v_alvos <> 90 OR v_manter <> 10 THEN
    RAISE EXCEPTION 'PRE-VALIDACAO FALHOU: remover=% manter=%', v_alvos, v_manter;
  END IF;

  -- Reportar staging_access_*
  FOR v_staging IN
    SELECT table_name FROM information_schema.tables
    WHERE table_schema='public' AND table_name LIKE 'staging_access_%'
  LOOP
    EXECUTE format('SELECT count(*) FROM public.%I', v_staging.table_name) INTO v_residuo;
    RAISE NOTICE 'STAGING (intocado) %: % linhas', v_staging.table_name, v_residuo;
  END LOOP;

  -- Desabilitar triggers de imutabilidade das tabelas de auditoria/eventos
  ALTER TABLE public.qa_cadastro_cr_audit              DISABLE TRIGGER trg_qa_cadastro_cr_audit_protect;
  ALTER TABLE public.qa_cliente_armas_auditoria        DISABLE TRIGGER qa_cliente_armas_audit_block_mut;
  ALTER TABLE public.qa_cliente_credenciais_audit      DISABLE TRIGGER trg_qa_cred_audit_imut;
  ALTER TABLE public.qa_gov_reconciliation_audit       DISABLE TRIGGER trg_audit_imutavel;
  ALTER TABLE public.qa_cliente_homologacao_eventos    DISABLE TRIGGER trg_qa_homol_eventos_no_delete;

  BEGIN
    -- Vendas e descendentes
    DELETE FROM public.qa_itens_venda
     WHERE venda_id IN (SELECT v.id_legado FROM public.qa_vendas v
        WHERE v.cliente_id IN (SELECT id_legado FROM _lr WHERE id_legado IS NOT NULL));
    GET DIAGNOSTICS v_residuo = ROW_COUNT; RAISE NOTICE 'DEL qa_itens_venda: %', v_residuo;

    DELETE FROM public.qa_venda_eventos
     WHERE venda_id IN (SELECT v.id FROM public.qa_vendas v
        WHERE v.cliente_id IN (SELECT id_legado FROM _lr WHERE id_legado IS NOT NULL));
    GET DIAGNOSTICS v_residuo = ROW_COUNT; RAISE NOTICE 'DEL qa_venda_eventos: %', v_residuo;

    DELETE FROM public.qa_vendas
     WHERE cliente_id IN (SELECT id_legado FROM _lr WHERE id_legado IS NOT NULL);
    GET DIAGNOSTICS v_residuo = ROW_COUNT; RAISE NOTICE 'DEL qa_vendas: %', v_residuo;

    DELETE FROM public.qa_geracoes_pecas WHERE cliente_id IN (SELECT id FROM _lr);
    GET DIAGNOSTICS v_residuo = ROW_COUNT; RAISE NOTICE 'DEL qa_geracoes_pecas: %', v_residuo;

    DELETE FROM public.qa_cliente_homologacao_eventos WHERE qa_cliente_id IN (SELECT id FROM _lr);
    GET DIAGNOSTICS v_residuo = ROW_COUNT; RAISE NOTICE 'DEL qa_cliente_homologacao_eventos: %', v_residuo;

    DELETE FROM public.qa_cadastro_cr WHERE cliente_id IN (SELECT id FROM _lr);
    GET DIAGNOSTICS v_residuo = ROW_COUNT; RAISE NOTICE 'DEL qa_cadastro_cr: %', v_residuo;

    DELETE FROM public.qa_documentos_cliente WHERE qa_cliente_id IN (SELECT id FROM _lr);
    GET DIAGNOSTICS v_residuo = ROW_COUNT; RAISE NOTICE 'DEL qa_documentos_cliente: %', v_residuo;

    DELETE FROM public.qa_crafs WHERE cliente_id IN (SELECT id FROM _lr);
    GET DIAGNOSTICS v_residuo = ROW_COUNT; RAISE NOTICE 'DEL qa_crafs: %', v_residuo;

    DELETE FROM public.qa_exames_cliente WHERE cliente_id IN (SELECT id FROM _lr);
    GET DIAGNOSTICS v_residuo = ROW_COUNT; RAISE NOTICE 'DEL qa_exames_cliente: %', v_residuo;

    DELETE FROM public.qa_filiacoes WHERE cliente_id IN (SELECT id FROM _lr);
    GET DIAGNOSTICS v_residuo = ROW_COUNT; RAISE NOTICE 'DEL qa_filiacoes: %', v_residuo;

    DELETE FROM public.qa_cliente_armas_manual WHERE qa_cliente_id IN (SELECT id FROM _lr);
    GET DIAGNOSTICS v_residuo = ROW_COUNT; RAISE NOTICE 'DEL qa_cliente_armas_manual: %', v_residuo;

    DELETE FROM public.qa_arsenal_notificacoes WHERE cliente_id IN (SELECT id FROM _lr);
    GET DIAGNOSTICS v_residuo = ROW_COUNT; RAISE NOTICE 'DEL qa_arsenal_notificacoes: %', v_residuo;

    DELETE FROM public.qa_cliente_kpi_layouts WHERE cliente_id IN (SELECT id FROM _lr);
    GET DIAGNOSTICS v_residuo = ROW_COUNT; RAISE NOTICE 'DEL qa_cliente_kpi_layouts: %', v_residuo;

    DELETE FROM public.qa_cliente_credenciais WHERE cliente_id IN (SELECT id FROM _lr);
    GET DIAGNOSTICS v_residuo = ROW_COUNT; RAISE NOTICE 'DEL qa_cliente_credenciais: %', v_residuo;

    DELETE FROM public.qa_senha_gov_acessos WHERE cliente_id IN (SELECT id FROM _lr);
    GET DIAGNOSTICS v_residuo = ROW_COUNT; RAISE NOTICE 'DEL qa_senha_gov_acessos: %', v_residuo;

    DELETE FROM public.cliente_auth_links WHERE qa_cliente_id IN (SELECT id FROM _lr);
    GET DIAGNOSTICS v_residuo = ROW_COUNT; RAISE NOTICE 'DEL cliente_auth_links: %', v_residuo;

    DELETE FROM public.qa_casos WHERE cliente_id IN (SELECT id FROM _lr);
    GET DIAGNOSTICS v_residuo = ROW_COUNT; RAISE NOTICE 'DEL qa_casos: %', v_residuo;

    -- Preservar qa_cadastro_publico (apenas desvincular)
    UPDATE public.qa_cadastro_publico SET cliente_id_vinculado = NULL
     WHERE cliente_id_vinculado IN (SELECT id FROM _lr);
    GET DIAGNOSTICS v_residuo = ROW_COUNT;
    RAISE NOTICE 'UPD qa_cadastro_publico desvinculados: %', v_residuo;

    -- Deletar clientes
    DELETE FROM public.qa_clientes WHERE id IN (SELECT id FROM _lr);
    GET DIAGNOSTICS v_residuo = ROW_COUNT; RAISE NOTICE 'DEL qa_clientes: %', v_residuo;
    IF v_residuo <> 90 THEN
      RAISE EXCEPTION 'DEL qa_clientes inesperado: % (esperado 90)', v_residuo;
    END IF;

  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'ALTER TABLE public.qa_cadastro_cr_audit           ENABLE TRIGGER trg_qa_cadastro_cr_audit_protect';
    EXECUTE 'ALTER TABLE public.qa_cliente_armas_auditoria     ENABLE TRIGGER qa_cliente_armas_audit_block_mut';
    EXECUTE 'ALTER TABLE public.qa_cliente_credenciais_audit   ENABLE TRIGGER trg_qa_cred_audit_imut';
    EXECUTE 'ALTER TABLE public.qa_gov_reconciliation_audit    ENABLE TRIGGER trg_audit_imutavel';
    EXECUTE 'ALTER TABLE public.qa_cliente_homologacao_eventos ENABLE TRIGGER trg_qa_homol_eventos_no_delete';
    RAISE;
  END;

  -- Reabilitar triggers
  ALTER TABLE public.qa_cadastro_cr_audit              ENABLE TRIGGER trg_qa_cadastro_cr_audit_protect;
  ALTER TABLE public.qa_cliente_armas_auditoria        ENABLE TRIGGER qa_cliente_armas_audit_block_mut;
  ALTER TABLE public.qa_cliente_credenciais_audit      ENABLE TRIGGER trg_qa_cred_audit_imut;
  ALTER TABLE public.qa_gov_reconciliation_audit       ENABLE TRIGGER trg_audit_imutavel;
  ALTER TABLE public.qa_cliente_homologacao_eventos    ENABLE TRIGGER trg_qa_homol_eventos_no_delete;

  -- Validação final
  SELECT count(*) INTO v_final FROM public.qa_clientes;
  RAISE NOTICE 'POS-VALIDACAO qa_clientes: % (esperado 10)', v_final;
  IF v_final <> 10 THEN
    RAISE EXCEPTION 'POS-VALIDACAO FALHOU: restantes=%', v_final;
  END IF;

  -- Resíduos críticos
  SELECT count(*) INTO v_residuo FROM public.qa_vendas v
  WHERE v.cliente_id IS NOT NULL
    AND v.cliente_id NOT IN (SELECT id_legado FROM public.qa_clientes WHERE id_legado IS NOT NULL);
  RAISE NOTICE 'RESIDUO qa_vendas orfas: %', v_residuo;
  IF v_residuo > 0 THEN RAISE EXCEPTION 'RESIDUO qa_vendas: %', v_residuo; END IF;

  SELECT count(*) INTO v_residuo FROM public.qa_cliente_homologacao_eventos h
  WHERE h.qa_cliente_id NOT IN (SELECT id FROM public.qa_clientes);
  RAISE NOTICE 'RESIDUO qa_cliente_homologacao_eventos orfas: %', v_residuo;
  IF v_residuo > 0 THEN RAISE EXCEPTION 'RESIDUO homolog: %', v_residuo; END IF;

  SELECT count(*) INTO v_residuo FROM public.qa_documentos_cliente d
  WHERE d.qa_cliente_id IS NOT NULL
    AND d.qa_cliente_id NOT IN (SELECT id FROM public.qa_clientes);
  RAISE NOTICE 'RESIDUO qa_documentos_cliente orfas: %', v_residuo;
  IF v_residuo > 0 THEN RAISE EXCEPTION 'RESIDUO documentos: %', v_residuo; END IF;

  RETURN QUERY SELECT 'qa_clientes_final'::text, v_final;
END;
$fn$;

ALTER FUNCTION public._qa_purge_legacy_fase2() OWNER TO postgres;

SELECT * FROM public._qa_purge_legacy_fase2();

DROP FUNCTION public._qa_purge_legacy_fase2();
