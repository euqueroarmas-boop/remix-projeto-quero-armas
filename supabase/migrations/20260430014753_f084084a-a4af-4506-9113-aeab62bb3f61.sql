
-- =====================================================================
-- FASE 16-E — RPCs para criar VENDA (não processo) a partir do cliente
-- =====================================================================

-- 1) RPC para CLIENTE LOGADO (usa auth.uid())
CREATE OR REPLACE FUNCTION public.qa_cliente_criar_contratacao(
  p_catalogo_slug      text,
  p_valor_informado    numeric,
  p_observacoes        text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid             uuid := auth.uid();
  v_is_staff        boolean;
  v_cliente_id_real integer;
  v_cliente_legado  integer;
  v_cat             public.qa_servicos_catalogo%ROWTYPE;
  v_venda_id        integer;
  v_venda_id_legado integer;
  v_item_id         integer;
  v_existente       record;
  v_now             timestamptz := now();
BEGIN
  -- Auth obrigatório
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.' USING ERRCODE = '28000';
  END IF;

  -- Validações de entrada
  IF p_catalogo_slug IS NULL OR length(btrim(p_catalogo_slug)) = 0 THEN
    RAISE EXCEPTION 'Serviço (catalogo_slug) é obrigatório.';
  END IF;
  IF p_valor_informado IS NULL OR p_valor_informado <= 0 THEN
    RAISE EXCEPTION 'Valor informado é obrigatório e deve ser maior que zero.';
  END IF;

  -- Resolve cliente logado (real id)
  v_is_staff := public.qa_is_active_staff(v_uid);
  v_cliente_id_real := public.qa_current_cliente_id(v_uid);

  IF v_cliente_id_real IS NULL THEN
    RAISE EXCEPTION 'Cadastro de cliente não vinculado ao usuário logado.';
  END IF;

  -- Resolve catálogo
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

  -- Resolve cliente_id legado (qa_vendas.cliente_id usa id_legado)
  SELECT COALESCE(id_legado, id) INTO v_cliente_legado
    FROM public.qa_clientes WHERE id = v_cliente_id_real;

  -- Idempotência: venda aberta do mesmo cliente para o mesmo serviço
  SELECT v.id, v.id_legado, v.valor_informado_cliente, v.status_validacao_valor
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
    -- Não duplica: retorna existente
    INSERT INTO public.qa_venda_eventos (
      venda_id, cliente_id, qa_cliente_id, tipo_evento, descricao, dados_json, ator, user_id
    ) VALUES (
      v_existente.id, v_cliente_legado, v_cliente_id_real,
      'contratacao_duplicada_ignorada',
      format('Tentativa de contratar serviço já em fila (slug=%s) ignorada (idempotência).', p_catalogo_slug),
      jsonb_build_object('slug', p_catalogo_slug, 'valor_informado', p_valor_informado),
      'cliente', v_uid
    );
    RETURN jsonb_build_object(
      'venda_id', v_existente.id,
      'venda_id_legado', v_existente.id_legado,
      'ja_existia', true,
      'status_validacao_valor', v_existente.status_validacao_valor,
      'cliente_id_real', v_cliente_id_real
    );
  END IF;

  -- Cria venda
  INSERT INTO public.qa_vendas (
    cliente_id, data_cadastro, status, valor_a_pagar, valor_aberto,
    valor_informado_cliente, status_validacao_valor, origem_proposta,
    validacao_valor_atualizado_em
  ) VALUES (
    v_cliente_legado, current_date, 'À INICIAR', 0, 0,
    p_valor_informado, 'aguardando_validacao', 'portal_cliente', v_now
  )
  RETURNING id, id_legado INTO v_venda_id, v_venda_id_legado;

  -- Cria item da venda
  INSERT INTO public.qa_itens_venda (venda_id, servico_id, valor, status, sort_order)
  VALUES (v_venda_id_legado, v_cat.servico_id, p_valor_informado, 'À INICIAR', 1)
  RETURNING id INTO v_item_id;

  -- Evento
  INSERT INTO public.qa_venda_eventos (
    venda_id, cliente_id, qa_cliente_id, tipo_evento, descricao, dados_json, ator, user_id
  ) VALUES (
    v_venda_id, v_cliente_legado, v_cliente_id_real,
    'contratacao_criada',
    format('Contratação criada pelo portal do cliente. Serviço: %s. Valor informado: R$ %s.',
           v_cat.nome, p_valor_informado::text),
    jsonb_build_object(
      'origem', 'portal_cliente',
      'slug', p_catalogo_slug,
      'servico_id', v_cat.servico_id,
      'valor_informado', p_valor_informado,
      'observacoes', p_observacoes
    ),
    'cliente', v_uid
  );

  RETURN jsonb_build_object(
    'venda_id', v_venda_id,
    'venda_id_legado', v_venda_id_legado,
    'item_id', v_item_id,
    'ja_existia', false,
    'status_validacao_valor', 'aguardando_validacao',
    'cliente_id_real', v_cliente_id_real
  );
END;
$$;

REVOKE ALL ON FUNCTION public.qa_cliente_criar_contratacao(text, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.qa_cliente_criar_contratacao(text, numeric, text) TO authenticated;


-- 2) RPC para FLUXO PÚBLICO (executada via service_role pela edge function)
--    Identifica/cria cliente por CPF e cria venda pendente.
CREATE OR REPLACE FUNCTION public.qa_cliente_criar_contratacao_publico(
  p_cpf                text,
  p_nome               text,
  p_email              text,
  p_telefone           text,
  p_catalogo_slug      text,
  p_valor_informado    numeric,
  p_observacoes        text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
  v_cat             public.qa_servicos_catalogo%ROWTYPE;
  v_venda_id        integer;
  v_venda_id_legado integer;
  v_item_id         integer;
  v_existente       record;
  v_match_count     integer := 0;
  v_now             timestamptz := now();
BEGIN
  -- Validações
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

  -- Resolve catálogo
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

  -- Identifica cliente por CPF
  SELECT COUNT(*) INTO v_match_count
    FROM public.qa_clientes
   WHERE public.qa_norm_doc(cpf) = v_cpf_norm
     AND COALESCE(excluido, false) = false;

  IF v_match_count > 1 THEN
    -- Múltiplos: exige revisão manual, não cria venda
    RETURN jsonb_build_object(
      'needs_manual_review', true,
      'reason', 'multiple_clients_by_cpf',
      'match_count', v_match_count
    );
  ELSIF v_match_count = 1 THEN
    SELECT id, status, user_id INTO v_cliente_id_real, v_cliente_status, v_cliente_uid
      FROM public.qa_clientes
     WHERE public.qa_norm_doc(cpf) = v_cpf_norm
       AND COALESCE(excluido, false) = false
     LIMIT 1;
    -- Cliente existente: NÃO cria novo, NÃO sobrescreve dados oficiais.
    -- Se já tem user_id (vinculado a auth), instrui login.
    IF v_cliente_uid IS NOT NULL THEN
      RETURN jsonb_build_object(
        'cliente_existente', true,
        'precisa_login', true,
        'qa_cliente_id', v_cliente_id_real,
        'mensagem', 'Já existe cadastro com este CPF. Faça login para contratar pelo portal.'
      );
    END IF;
    -- Cliente existe mas sem auth: pode criar venda pelo fluxo público.
  ELSE
    -- Cliente NOVO: cria com status cadastro_em_preenchimento
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

  -- cliente_id legado para qa_vendas
  SELECT COALESCE(id_legado, id) INTO v_cliente_legado
    FROM public.qa_clientes WHERE id = v_cliente_id_real;

  -- Idempotência: venda aberta do mesmo cliente para o mesmo serviço
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
    INSERT INTO public.qa_venda_eventos (
      venda_id, cliente_id, qa_cliente_id, tipo_evento, descricao, dados_json, ator
    ) VALUES (
      v_existente.id, v_cliente_legado, v_cliente_id_real,
      'contratacao_duplicada_ignorada',
      format('Tentativa pública duplicada para serviço %s ignorada (idempotência).', p_catalogo_slug),
      jsonb_build_object('slug', p_catalogo_slug, 'origem', 'wizard_publico'),
      'sistema'
    );
    RETURN jsonb_build_object(
      'venda_id', v_existente.id,
      'venda_id_legado', v_existente.id_legado,
      'ja_existia', true,
      'cliente_id_real', v_cliente_id_real,
      'cliente_criado', v_cliente_criado,
      'status_validacao_valor', v_existente.status_validacao_valor
    );
  END IF;

  -- Cria venda
  INSERT INTO public.qa_vendas (
    cliente_id, data_cadastro, status, valor_a_pagar, valor_aberto,
    valor_informado_cliente, status_validacao_valor, origem_proposta,
    validacao_valor_atualizado_em
  ) VALUES (
    v_cliente_legado, current_date, 'À INICIAR', 0, 0,
    p_valor_informado, 'aguardando_validacao', 'wizard_publico', v_now
  )
  RETURNING id, id_legado INTO v_venda_id, v_venda_id_legado;

  -- Item
  INSERT INTO public.qa_itens_venda (venda_id, servico_id, valor, status, sort_order)
  VALUES (v_venda_id_legado, v_cat.servico_id, p_valor_informado, 'À INICIAR', 1)
  RETURNING id INTO v_item_id;

  -- Evento
  INSERT INTO public.qa_venda_eventos (
    venda_id, cliente_id, qa_cliente_id, tipo_evento, descricao, dados_json, ator
  ) VALUES (
    v_venda_id, v_cliente_legado, v_cliente_id_real,
    'contratacao_criada',
    format('Contratação criada via fluxo público. Serviço: %s. Valor informado: R$ %s.',
           v_cat.nome, p_valor_informado::text),
    jsonb_build_object(
      'origem', 'wizard_publico',
      'slug', p_catalogo_slug,
      'servico_id', v_cat.servico_id,
      'valor_informado', p_valor_informado,
      'cliente_criado', v_cliente_criado,
      'cliente_status', v_cliente_status,
      'observacoes', p_observacoes,
      'cpf_mascarado', substr(v_cpf_norm,1,3) || '***' || substr(v_cpf_norm,9,3)
    ),
    'cliente'
  );

  RETURN jsonb_build_object(
    'venda_id', v_venda_id,
    'venda_id_legado', v_venda_id_legado,
    'item_id', v_item_id,
    'ja_existia', false,
    'cliente_id_real', v_cliente_id_real,
    'cliente_criado', v_cliente_criado,
    'cliente_status', v_cliente_status,
    'status_validacao_valor', 'aguardando_validacao'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.qa_cliente_criar_contratacao_publico(text,text,text,text,text,numeric,text) FROM PUBLIC;
-- Apenas service_role chama essa (anon não pode criar cliente direto)
GRANT EXECUTE ON FUNCTION public.qa_cliente_criar_contratacao_publico(text,text,text,text,text,numeric,text) TO service_role;
