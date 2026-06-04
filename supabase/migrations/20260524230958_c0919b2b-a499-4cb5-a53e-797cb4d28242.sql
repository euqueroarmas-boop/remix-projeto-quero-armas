
-- Arquivamento seguro de clientes Quero Armas
ALTER TABLE public.qa_clientes
  ADD COLUMN IF NOT EXISTS arquivado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS arquivado_em timestamptz NULL,
  ADD COLUMN IF NOT EXISTS arquivado_por uuid NULL,
  ADD COLUMN IF NOT EXISTS motivo_arquivamento text NULL;

CREATE INDEX IF NOT EXISTS idx_qa_clientes_arquivado ON public.qa_clientes(arquivado);

-- Função utilitária: conta dependências por tabela usando id e id_legado
CREATE OR REPLACE FUNCTION public.qa_cliente_dependencias(p_cliente_id integer)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
BEGIN
  SELECT id_legado INTO v_id_legado FROM qa_clientes WHERE id = p_cliente_id;

  -- qa_vendas: cliente_id pode referenciar id ou id_legado historicamente
  SELECT count(*) INTO v_vendas FROM qa_vendas
    WHERE cliente_id = p_cliente_id OR (v_id_legado IS NOT NULL AND cliente_id = v_id_legado);

  SELECT count(*) INTO v_itens FROM qa_itens_venda
    WHERE cliente_id = p_cliente_id OR (v_id_legado IS NOT NULL AND cliente_id = v_id_legado);

  -- Processos
  BEGIN
    SELECT count(*) INTO v_processos FROM qa_processos
      WHERE cliente_id = p_cliente_id OR (v_id_legado IS NOT NULL AND cliente_id = v_id_legado);
  EXCEPTION WHEN undefined_table OR undefined_column THEN v_processos := 0; END;

  -- Contratos (id_legado normalmente)
  BEGIN
    SELECT count(*) INTO v_contracts FROM qa_contracts
      WHERE cliente_id = p_cliente_id OR (v_id_legado IS NOT NULL AND cliente_id = v_id_legado);
  EXCEPTION WHEN undefined_table OR undefined_column THEN v_contracts := 0; END;

  -- Cobranças Asaas
  BEGIN
    SELECT count(*) INTO v_cobrancas FROM qa_cobrancas_asaas
      WHERE cliente_id = p_cliente_id OR (v_id_legado IS NOT NULL AND cliente_id = v_id_legado);
  EXCEPTION WHEN undefined_table OR undefined_column THEN v_cobrancas := 0; END;

  -- Documentos
  BEGIN
    SELECT count(*) INTO v_docs FROM qa_documentos_cliente
      WHERE qa_cliente_id = p_cliente_id;
  EXCEPTION WHEN undefined_table OR undefined_column THEN v_docs := 0; END;

  -- Vínculo portal
  BEGIN
    SELECT count(*) INTO v_portal FROM cliente_auth_links
      WHERE qa_cliente_id = p_cliente_id;
  EXCEPTION WHEN undefined_table OR undefined_column THEN v_portal := 0; END;

  -- Cadastro/Arsenal (sempre id real)
  BEGIN SELECT count(*) INTO v_crafs FROM qa_crafs WHERE cliente_id = p_cliente_id;
  EXCEPTION WHEN undefined_table THEN v_crafs := 0; END;
  BEGIN SELECT count(*) INTO v_gtes FROM qa_gtes WHERE cliente_id = p_cliente_id;
  EXCEPTION WHEN undefined_table THEN v_gtes := 0; END;
  BEGIN SELECT count(*) INTO v_cr FROM qa_cadastro_cr WHERE cliente_id = p_cliente_id;
  EXCEPTION WHEN undefined_table THEN v_cr := 0; END;
  BEGIN SELECT count(*) INTO v_exames FROM qa_exames_cliente WHERE cliente_id = p_cliente_id;
  EXCEPTION WHEN undefined_table THEN v_exames := 0; END;
  BEGIN SELECT count(*) INTO v_filiacoes FROM qa_filiacoes WHERE cliente_id = p_cliente_id;
  EXCEPTION WHEN undefined_table THEN v_filiacoes := 0; END;

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
    'tem_vinculo_critico', (v_vendas + v_itens + v_processos + v_contracts + v_cobrancas + v_docs + v_portal) > 0
  );
END;
$$;

-- RPC de arquivar
CREATE OR REPLACE FUNCTION public.qa_cliente_arquivar(p_cliente_id integer, p_motivo text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  -- Apenas staff ativo pode arquivar
  IF NOT qa_is_active_staff() THEN
    RAISE EXCEPTION 'Sem permissão para arquivar cliente';
  END IF;

  UPDATE qa_clientes
     SET arquivado = true,
         arquivado_em = now(),
         arquivado_por = v_uid,
         motivo_arquivamento = COALESCE(NULLIF(trim(p_motivo), ''), 'Arquivamento por vínculos críticos (vendas/processos).')
   WHERE id = p_cliente_id;

  RETURN jsonb_build_object('ok', true, 'cliente_id', p_cliente_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.qa_cliente_restaurar(p_cliente_id integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT qa_is_active_staff() THEN
    RAISE EXCEPTION 'Sem permissão para restaurar cliente';
  END IF;

  UPDATE qa_clientes
     SET arquivado = false,
         arquivado_em = NULL,
         arquivado_por = NULL,
         motivo_arquivamento = NULL
   WHERE id = p_cliente_id;

  RETURN jsonb_build_object('ok', true, 'cliente_id', p_cliente_id);
END;
$$;
