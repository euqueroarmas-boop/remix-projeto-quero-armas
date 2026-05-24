CREATE OR REPLACE FUNCTION public.qa_cliente_dependencias(p_cliente_id integer)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_id_legado integer;
  v_vendas int := 0;
  v_itens int := 0;
  v_processos int := 0;
  v_contracts int := 0;
  v_cobrancas int := 0;
  v_docs int := 0;
  v_portal int := 0;
  v_crafs int := 0;
  v_gtes int := 0;
  v_cr int := 0;
  v_exames int := 0;
  v_filiacoes int := 0;
  v_count int;
BEGIN
  SELECT id_legado INTO v_id_legado FROM qa_clientes WHERE id = p_cliente_id;

  -- qa_vendas: cliente_id pode referenciar id ou id_legado historicamente
  BEGIN
    EXECUTE 'SELECT count(*) FROM qa_vendas WHERE cliente_id = $1 OR ($2 IS NOT NULL AND cliente_id = $2)'
      INTO v_vendas USING p_cliente_id, v_id_legado;
  EXCEPTION WHEN undefined_table OR undefined_column THEN v_vendas := 0; END;

  -- qa_itens_venda: NÃO tem cliente_id. Conta via JOIN com qa_vendas (id ou id_legado)
  BEGIN
    EXECUTE $q$
      SELECT count(*) FROM qa_itens_venda iv
      JOIN qa_vendas v
        ON iv.venda_id = v.id
        OR (v.id_legado IS NOT NULL AND iv.venda_id = v.id_legado)
      WHERE v.cliente_id = $1
        OR ($2 IS NOT NULL AND v.cliente_id = $2)
    $q$ INTO v_itens USING p_cliente_id, v_id_legado;
  EXCEPTION WHEN undefined_table OR undefined_column THEN v_itens := 0; END;

  BEGIN
    EXECUTE 'SELECT count(*) FROM qa_processos WHERE cliente_id = $1 OR ($2 IS NOT NULL AND cliente_id = $2)'
      INTO v_processos USING p_cliente_id, v_id_legado;
  EXCEPTION WHEN undefined_table OR undefined_column THEN v_processos := 0; END;

  BEGIN
    EXECUTE 'SELECT count(*) FROM qa_contracts WHERE cliente_id = $1 OR ($2 IS NOT NULL AND cliente_id = $2)'
      INTO v_contracts USING p_cliente_id, v_id_legado;
  EXCEPTION WHEN undefined_table OR undefined_column THEN v_contracts := 0; END;

  BEGIN
    EXECUTE 'SELECT count(*) FROM qa_cobrancas_asaas WHERE cliente_id = $1 OR ($2 IS NOT NULL AND cliente_id = $2)'
      INTO v_cobrancas USING p_cliente_id, v_id_legado;
  EXCEPTION WHEN undefined_table OR undefined_column THEN v_cobrancas := 0; END;

  BEGIN
    EXECUTE 'SELECT count(*) FROM qa_documentos_cliente WHERE qa_cliente_id = $1'
      INTO v_docs USING p_cliente_id;
  EXCEPTION WHEN undefined_table OR undefined_column THEN v_docs := 0; END;

  BEGIN
    EXECUTE 'SELECT count(*) FROM cliente_auth_links WHERE qa_cliente_id = $1'
      INTO v_portal USING p_cliente_id;
  EXCEPTION WHEN undefined_table OR undefined_column THEN v_portal := 0; END;

  BEGIN
    EXECUTE 'SELECT count(*) FROM qa_crafs WHERE cliente_id = $1' INTO v_crafs USING p_cliente_id;
  EXCEPTION WHEN undefined_table OR undefined_column THEN v_crafs := 0; END;
  BEGIN
    EXECUTE 'SELECT count(*) FROM qa_gtes WHERE cliente_id = $1' INTO v_gtes USING p_cliente_id;
  EXCEPTION WHEN undefined_table OR undefined_column THEN v_gtes := 0; END;
  BEGIN
    EXECUTE 'SELECT count(*) FROM qa_cadastro_cr WHERE cliente_id = $1' INTO v_cr USING p_cliente_id;
  EXCEPTION WHEN undefined_table OR undefined_column THEN v_cr := 0; END;
  BEGIN
    EXECUTE 'SELECT count(*) FROM qa_exames_cliente WHERE cliente_id = $1' INTO v_exames USING p_cliente_id;
  EXCEPTION WHEN undefined_table OR undefined_column THEN v_exames := 0; END;
  BEGIN
    EXECUTE 'SELECT count(*) FROM qa_filiacoes WHERE cliente_id = $1' INTO v_filiacoes USING p_cliente_id;
  EXCEPTION WHEN undefined_table OR undefined_column THEN v_filiacoes := 0; END;

  RETURN jsonb_build_object(
    'cliente_id', p_cliente_id,
    'id_legado', v_id_legado,
    'vendas', v_vendas,
    'itens_venda', v_itens,
    'processos', v_processos,
    'contracts', v_contracts,
    'cobrancas_asaas', v_cobrancas,
    'documentos', v_docs,
    'portal_links', v_portal,
    'crafs', v_crafs,
    'gtes', v_gtes,
    'cadastro_cr', v_cr,
    'exames', v_exames,
    'filiacoes', v_filiacoes,
    'tem_vinculo_critico', (v_vendas + v_itens + v_processos + v_contracts + v_cobrancas) > 0
  );
END;
$function$;