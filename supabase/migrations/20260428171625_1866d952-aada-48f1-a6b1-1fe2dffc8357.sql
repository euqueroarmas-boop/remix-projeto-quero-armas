-- ============================================================================
-- Fase 2 — Contratação rápida para cliente logado (revisão + criação automática)
-- ============================================================================

-- 1) RPC: cria processo a partir do catálogo, com checklist herdado de qa_servicos
--    (replica os documentos obrigatórios do serviço como qa_processo_documentos
--     'pendente'). Retorna o id do processo criado.
CREATE OR REPLACE FUNCTION public.qa_criar_processo_logado(
  p_cliente_id        integer,
  p_catalogo_slug     text,
  p_observacoes       text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid             uuid := auth.uid();
  v_cliente_owner   integer;
  v_is_staff        boolean;
  v_cat             public.qa_servicos_catalogo%ROWTYPE;
  v_servico_id      integer;
  v_servico_nome    text;
  v_processo_id     uuid;
BEGIN
  -- Auth: precisa ser dono do cliente OU staff
  v_is_staff := public.qa_is_active_staff(v_uid);
  v_cliente_owner := public.qa_current_cliente_id(v_uid);
  IF NOT v_is_staff AND (v_cliente_owner IS NULL OR v_cliente_owner <> p_cliente_id) THEN
    RAISE EXCEPTION 'Não autorizado a criar processo para este cliente.';
  END IF;

  -- Catálogo
  SELECT * INTO v_cat FROM public.qa_servicos_catalogo WHERE slug = p_catalogo_slug AND ativo = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Serviço não encontrado ou inativo: %', p_catalogo_slug;
  END IF;

  IF v_cat.gera_processo = false THEN
    RAISE EXCEPTION 'Este item do catálogo não gera processo (apenas produto/avulso): %', p_catalogo_slug;
  END IF;

  -- Mapeia o servico_id (FK) e nome do serviço (qa_servicos)
  v_servico_id := v_cat.servico_id;
  IF v_servico_id IS NOT NULL THEN
    SELECT nome INTO v_servico_nome FROM public.qa_servicos WHERE id = v_servico_id;
  END IF;
  v_servico_nome := COALESCE(v_servico_nome, v_cat.nome);

  -- Cria o processo com pagamento_status = 'aguardando' (validação manual posterior)
  INSERT INTO public.qa_processos (
    cliente_id, servico_id, servico_nome,
    pagamento_status, status, observacoes_admin
  ) VALUES (
    p_cliente_id, v_servico_id, v_servico_nome,
    'aguardando', 'aguardando_pagamento',
    COALESCE(p_observacoes, 'Contratação via portal do cliente (' || v_cat.slug || ')')
  )
  RETURNING id INTO v_processo_id;

  -- Replica documentos obrigatórios do serviço (qa_servicos_documentos) como checklist
  -- Se a tabela existir, monta os pendentes — caso contrário, mantém vazio.
  BEGIN
    INSERT INTO public.qa_processo_documentos (
      processo_id, cliente_id, tipo_documento, nome_documento, etapa,
      status, obrigatorio, formato_aceito
    )
    SELECT
      v_processo_id, p_cliente_id, sd.tipo_documento, sd.nome_documento,
      COALESCE(sd.etapa, 'base'), 'pendente', COALESCE(sd.obrigatorio, true),
      COALESCE(sd.formato_aceito, ARRAY['pdf','jpg','jpeg','png'])
    FROM public.qa_servicos_documentos sd
    WHERE sd.servico_id = v_servico_id;
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    -- Tabela qa_servicos_documentos pode não existir — segue sem checklist preenchido
    NULL;
  END;

  -- Evento de auditoria
  INSERT INTO public.qa_processo_eventos (processo_id, tipo_evento, descricao, dados_json, ator, user_id)
  VALUES (
    v_processo_id, 'contratacao_portal',
    'Cliente contratou serviço pelo portal: ' || v_cat.nome,
    jsonb_build_object('slug', v_cat.slug, 'catalogo_id', v_cat.id, 'origem', 'portal_cliente_logado'),
    CASE WHEN v_is_staff THEN 'staff' ELSE 'cliente' END,
    v_uid
  );

  RETURN v_processo_id;
END;
$$;

-- Executável por authenticated (a função valida internamente)
GRANT EXECUTE ON FUNCTION public.qa_criar_processo_logado(integer, text, text) TO authenticated;

-- 2) Atualizar dados básicos do cliente (endereço, estado civil, profissão) — RPC
--    Permite que o cliente atualize seus próprios dados na tela de revisão
--    sem precisar de RLS update direto (mantém integridade auditável).
CREATE OR REPLACE FUNCTION public.qa_atualizar_dados_basicos_cliente(
  p_cliente_id        integer,
  p_estado_civil      text DEFAULT NULL,
  p_profissao         text DEFAULT NULL,
  p_cep               text DEFAULT NULL,
  p_endereco          text DEFAULT NULL,
  p_numero            text DEFAULT NULL,
  p_complemento       text DEFAULT NULL,
  p_bairro            text DEFAULT NULL,
  p_cidade            text DEFAULT NULL,
  p_estado            text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid           uuid := auth.uid();
  v_cliente_owner integer;
  v_is_staff      boolean;
BEGIN
  v_is_staff := public.qa_is_active_staff(v_uid);
  v_cliente_owner := public.qa_current_cliente_id(v_uid);
  IF NOT v_is_staff AND (v_cliente_owner IS NULL OR v_cliente_owner <> p_cliente_id) THEN
    RAISE EXCEPTION 'Não autorizado a atualizar dados deste cliente.';
  END IF;

  UPDATE public.qa_clientes SET
    estado_civil = COALESCE(NULLIF(UPPER(TRIM(p_estado_civil)), ''), estado_civil),
    profissao    = COALESCE(NULLIF(UPPER(TRIM(p_profissao)), ''),    profissao),
    cep          = COALESCE(NULLIF(TRIM(p_cep), ''),                  cep),
    endereco     = COALESCE(NULLIF(UPPER(TRIM(p_endereco)), ''),      endereco),
    numero       = COALESCE(NULLIF(TRIM(p_numero), ''),               numero),
    complemento  = COALESCE(NULLIF(UPPER(TRIM(p_complemento)), ''),   complemento),
    bairro       = COALESCE(NULLIF(UPPER(TRIM(p_bairro)), ''),        bairro),
    cidade       = COALESCE(NULLIF(UPPER(TRIM(p_cidade)), ''),        cidade),
    estado       = COALESCE(NULLIF(UPPER(TRIM(p_estado)), ''),        estado),
    updated_at   = now()
  WHERE id = p_cliente_id;

  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.qa_atualizar_dados_basicos_cliente(integer, text, text, text, text, text, text, text, text, text) TO authenticated;