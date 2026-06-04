-- =====================================================================
-- FASE 20-D: BLOCK PURCHASE FROM NON-HOMOLOGATED LEGACY CLIENTS
-- =====================================================================

-- 1) RPC: verifies if a client can contract a service
CREATE OR REPLACE FUNCTION public.qa_verificar_cliente_pode_contratar(
  p_cliente_id integer,
  p_catalogo_slug text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cli           record;
  v_pode          boolean := false;
  v_motivo        text := 'ok';
  v_requires_rec  boolean := false;
  v_new_rec_st    text;
BEGIN
  IF p_cliente_id IS NULL THEN
    RAISE EXCEPTION 'cliente_id obrigatório';
  END IF;

  SELECT id, cliente_legado, homologacao_status, recadastramento_status,
         tipo_cliente, excluido, status
    INTO v_cli
    FROM public.qa_clientes
   WHERE id = p_cliente_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cliente não encontrado.';
  END IF;

  IF COALESCE(v_cli.excluido, false) = true OR v_cli.status = 'excluido_lgpd' THEN
    RAISE EXCEPTION 'Cliente excluído.';
  END IF;

  -- Regras
  IF v_cli.tipo_cliente = 'cliente_app' THEN
    v_pode := true;
  ELSIF COALESCE(v_cli.cliente_legado, false) = false THEN
    v_pode := true;
  ELSIF v_cli.cliente_legado = true AND v_cli.homologacao_status = 'homologado' THEN
    v_pode := true;
  ELSE
    -- Legado pendente: bloqueia
    v_pode := false;
    v_requires_rec := true;
    v_motivo := 'cliente_legado_nao_homologado';

    v_new_rec_st := CASE
      WHEN v_cli.recadastramento_status IS NULL
        OR v_cli.recadastramento_status = 'nao_iniciado'
        THEN 'solicitado_pela_tentativa_de_compra'
      ELSE v_cli.recadastramento_status
    END;

    UPDATE public.qa_clientes
       SET tentativa_compra_legado_em    = now(),
           tentativa_compra_legado_count = COALESCE(tentativa_compra_legado_count, 0) + 1,
           recadastramento_status        = v_new_rec_st
     WHERE id = p_cliente_id;

    INSERT INTO public.qa_cliente_homologacao_eventos (
      cliente_id, tipo_evento, ator, descricao, dados_json
    ) VALUES (
      p_cliente_id,
      'tentativa_compra_legado',
      'cliente',
      'Cliente legado tentou contratar serviço antes da homologação.',
      jsonb_build_object(
        'catalogo_slug', p_catalogo_slug,
        'homologacao_status', v_cli.homologacao_status,
        'recadastramento_status', v_new_rec_st,
        'origem', 'fase_20_d'
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'pode_contratar', v_pode,
    'motivo', v_motivo,
    'requires_recadastramento', v_requires_rec,
    'cliente_legado', COALESCE(v_cli.cliente_legado, false),
    'homologacao_status', v_cli.homologacao_status,
    'recadastramento_status', CASE WHEN v_pode THEN v_cli.recadastramento_status ELSE v_new_rec_st END,
    'cliente_id', p_cliente_id,
    'catalogo_slug', p_catalogo_slug
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.qa_verificar_cliente_pode_contratar(integer, text) TO authenticated, service_role;

-- =====================================================================
-- 2) Update public contracting RPC: block legacy pending BEFORE creating sale
-- =====================================================================
CREATE OR REPLACE FUNCTION public.qa_cliente_criar_contratacao_publico(
  p_cpf text,
  p_nome text,
  p_email text,
  p_telefone text,
  p_catalogo_slug text,
  p_valor_informado numeric,
  p_observacoes text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cpf_norm        text;
  v_email_norm      text;
  v_nome_norm       text;
  v_cliente_id_real integer;
  v_cliente_legado  integer;
  v_cliente_criado  boolean := false;
  v_cliente_status  text;
  v_cliente_uid     uuid;
  v_cli_legado_flag boolean;
  v_cli_homol_st    text;
  v_cli_recad_st    text;
  v_new_rec_st      text;
  v_cat             public.qa_servicos_catalogo%ROWTYPE;
  v_venda_id        integer;
  v_venda_id_legado integer;
  v_item_id         integer;
  v_existente       record;
  v_match_count     integer := 0;
  v_now             timestamptz := now();
BEGIN
  v_cpf_norm := public.qa_norm_doc(p_cpf);
  IF v_cpf_norm IS NULL OR length(v_cpf_norm) <> 11 THEN
    RAISE EXCEPTION 'CPF inválido.';
  END IF;
  IF p_nome IS NULL OR length(btrim(p_nome)) < 3 THEN
    RAISE EXCEPTION 'Nome completo é obrigatório.';
  END IF;
  v_email_norm := public.qa_norm_email(p_email);
  IF v_email_norm IS NULL THEN
    RAISE EXCEPTION 'E-mail é obrigatório.';
  END IF;
  IF p_valor_informado IS NULL OR p_valor_informado <= 0 THEN
    RAISE EXCEPTION 'Valor informado é obrigatório e deve ser maior que zero.';
  END IF;
  IF p_catalogo_slug IS NULL OR length(btrim(p_catalogo_slug)) = 0 THEN
    RAISE EXCEPTION 'Serviço (catalogo_slug) é obrigatório.';
  END IF;

  SELECT * INTO v_cat
    FROM public.qa_servicos_catalogo
   WHERE slug = p_catalogo_slug AND ativo = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Serviço não encontrado ou inativo: %', p_catalogo_slug;
  END IF;
  IF v_cat.servico_id IS NULL THEN
    RAISE EXCEPTION 'Este serviço ainda não está pronto para contratação online. Fale com a Equipe Operacional da Quero Armas.'
      USING ERRCODE = 'P0001';
  END IF;

  v_nome_norm := upper(btrim(p_nome));

  SELECT COUNT(*) INTO v_match_count
    FROM public.qa_clientes
   WHERE public.qa_norm_doc(cpf) = v_cpf_norm
     AND COALESCE(excluido, false) = false;

  IF v_match_count > 1 THEN
    RETURN jsonb_build_object(
      'needs_manual_review', true,
      'reason', 'multiple_clients_by_cpf',
      'match_count', v_match_count
    );
  ELSIF v_match_count = 1 THEN
    SELECT id, status, user_id, cliente_legado, homologacao_status, recadastramento_status
      INTO v_cliente_id_real, v_cliente_status, v_cliente_uid, v_cli_legado_flag, v_cli_homol_st, v_cli_recad_st
      FROM public.qa_clientes
     WHERE public.qa_norm_doc(cpf) = v_cpf_norm
       AND COALESCE(excluido, false) = false
     LIMIT 1;

    -- FASE 20-D: bloqueio de cliente legado pendente (antes de qualquer criação)
    IF COALESCE(v_cli_legado_flag, false) = true
       AND COALESCE(v_cli_homol_st, '') <> 'homologado' THEN

      v_new_rec_st := CASE
        WHEN v_cli_recad_st IS NULL OR v_cli_recad_st = 'nao_iniciado'
          THEN 'solicitado_pela_tentativa_de_compra'
        ELSE v_cli_recad_st
      END;

      UPDATE public.qa_clientes
         SET tentativa_compra_legado_em    = now(),
             tentativa_compra_legado_count = COALESCE(tentativa_compra_legado_count, 0) + 1,
             recadastramento_status        = v_new_rec_st
       WHERE id = v_cliente_id_real;

      INSERT INTO public.qa_cliente_homologacao_eventos (
        cliente_id, tipo_evento, ator, descricao, dados_json
      ) VALUES (
        v_cliente_id_real,
        'tentativa_compra_legado',
        'cliente',
        'Cliente legado tentou contratar serviço (fluxo público) antes da homologação.',
        jsonb_build_object(
          'catalogo_slug', p_catalogo_slug,
          'homologacao_status', v_cli_homol_st,
          'recadastramento_status', v_new_rec_st,
          'origem', 'fase_20_d_publico'
        )
      );

      RETURN jsonb_build_object(
        'ok', false,
        'requires_recadastramento', true,
        'reason', 'cliente_legado_nao_homologado',
        'qa_cliente_id', v_cliente_id_real,
        'mensagem', 'Seu cadastro precisa ser atualizado antes de contratar novo serviço.'
      );
    END IF;

    IF v_cliente_uid IS NOT NULL THEN
      RETURN jsonb_build_object(
        'cliente_existente', true,
        'precisa_login', true,
        'qa_cliente_id', v_cliente_id_real,
        'mensagem', 'Já existe cadastro com este CPF. Faça login para contratar pelo portal.'
      );
    END IF;
  ELSE
    INSERT INTO public.qa_clientes (
      nome_completo, cpf, email, celular, status, origem
    ) VALUES (
      v_nome_norm, v_cpf_norm, v_email_norm,
      NULLIF(regexp_replace(coalesce(p_telefone,''), '[^0-9]', '', 'g'), ''),
      'cadastro_em_preenchimento', 'fluxo_publico_contratacao'
    )
    RETURNING id INTO v_cliente_id_real;
    v_cliente_criado := true;
    v_cliente_status := 'cadastro_em_preenchimento';
  END IF;

  SELECT COALESCE(id_legado, id) INTO v_cliente_legado
    FROM public.qa_clientes WHERE id = v_cliente_id_real;

  SELECT v.id, v.id_legado, v.status_validacao_valor
    INTO v_existente
    FROM public.qa_vendas v
    JOIN public.qa_itens_venda iv ON iv.venda_id = v.id_legado
   WHERE v.cliente_id = v_cliente_legado
     AND iv.servico_id = v_cat.servico_id
     AND COALESCE(v.status_validacao_valor, 'aguardando_validacao')
         IN ('aguardando_validacao','corrigido')
   ORDER BY v.created_at DESC
   LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'ok', true,
      'ja_existia', true,
      'venda_id', v_existente.id,
      'qa_cliente_id', v_cliente_id_real
    );
  END IF;

  -- Cria venda
  INSERT INTO public.qa_vendas (
    cliente_id, valor_total, status_validacao_valor,
    valor_informado_cliente, observacoes, origem, created_at
  ) VALUES (
    v_cliente_legado, p_valor_informado, 'aguardando_validacao',
    p_valor_informado, p_observacoes, 'fluxo_publico_contratacao', v_now
  )
  RETURNING id, id_legado INTO v_venda_id, v_venda_id_legado;

  INSERT INTO public.qa_itens_venda (
    venda_id, servico_id, quantidade, valor_unitario, valor_total
  ) VALUES (
    v_venda_id_legado, v_cat.servico_id, 1, p_valor_informado, p_valor_informado
  )
  RETURNING id INTO v_item_id;

  RETURN jsonb_build_object(
    'ok', true,
    'venda_id', v_venda_id,
    'qa_cliente_id', v_cliente_id_real,
    'cliente_criado', v_cliente_criado
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.qa_cliente_criar_contratacao_publico(text,text,text,text,text,numeric,text) TO anon, authenticated, service_role;