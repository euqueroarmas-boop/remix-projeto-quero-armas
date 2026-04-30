-- FASE 17-A: RPC para criação de conta pública gratuita do app de arsenal
CREATE OR REPLACE FUNCTION public.qa_cliente_criar_conta_publica(
  p_user_id uuid,
  p_cpf text,
  p_nome text,
  p_email text,
  p_telefone text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cpf_norm text;
  v_email_norm text;
  v_cliente_id integer;
  v_existing_user uuid;
  v_id_legado integer;
  v_cliente_created boolean := false;
  v_link_created boolean := false;
  v_tipo_cliente text := 'cliente_app';
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'p_user_id obrigatório';
  END IF;
  IF p_cpf IS NULL OR length(trim(p_cpf)) = 0 THEN
    RAISE EXCEPTION 'CPF obrigatório';
  END IF;
  IF p_nome IS NULL OR length(trim(p_nome)) < 2 THEN
    RAISE EXCEPTION 'Nome obrigatório';
  END IF;
  IF p_email IS NULL OR length(trim(p_email)) = 0 THEN
    RAISE EXCEPTION 'E-mail obrigatório';
  END IF;

  v_cpf_norm := regexp_replace(coalesce(p_cpf, ''), '[^0-9]', '', 'g');
  IF length(v_cpf_norm) <> 11 THEN
    RAISE EXCEPTION 'CPF inválido';
  END IF;

  v_email_norm := lower(trim(p_email));

  -- Verifica cliente existente por CPF
  SELECT id INTO v_cliente_id
  FROM public.qa_clientes
  WHERE regexp_replace(coalesce(cpf, ''), '[^0-9]', '', 'g') = v_cpf_norm
    AND coalesce(excluido, false) = false
  ORDER BY id ASC
  LIMIT 1;

  -- Se cliente existe e já tem login ativo de outro user, orienta login
  IF v_cliente_id IS NOT NULL THEN
    SELECT user_id INTO v_existing_user
    FROM public.cliente_auth_links
    WHERE qa_cliente_id = v_cliente_id
      AND status = 'active'
    LIMIT 1;

    IF v_existing_user IS NOT NULL AND v_existing_user <> p_user_id THEN
      RETURN jsonb_build_object(
        'ok', false,
        'reason', 'cpf_ja_possui_login',
        'message', 'Este CPF já possui acesso ao portal. Faça login.'
      );
    END IF;
  ELSE
    -- Cria novo cliente (não rebaixa nada porque não existe)
    SELECT coalesce(max(id_legado), 0) + 1 INTO v_id_legado FROM public.qa_clientes;

    BEGIN
      INSERT INTO public.qa_clientes (
        id_legado, nome_completo, cpf, email, celular,
        status, origem, tipo_cliente, excluido
      ) VALUES (
        v_id_legado,
        upper(trim(p_nome)),
        v_cpf_norm,
        v_email_norm,
        nullif(trim(coalesce(p_telefone, '')), ''),
        'conta_gratuita_arsenal',
        'app_arsenal_publico',
        v_tipo_cliente,
        false
      )
      RETURNING id INTO v_cliente_id;
      v_cliente_created := true;
    EXCEPTION WHEN check_violation THEN
      -- fallback se tipo_cliente quebrar constraint futura
      INSERT INTO public.qa_clientes (
        id_legado, nome_completo, cpf, email, celular,
        status, origem, excluido
      ) VALUES (
        v_id_legado,
        upper(trim(p_nome)),
        v_cpf_norm,
        v_email_norm,
        nullif(trim(coalesce(p_telefone, '')), ''),
        'conta_gratuita_arsenal',
        'app_arsenal_publico',
        false
      )
      RETURNING id INTO v_cliente_id;
      v_cliente_created := true;
      v_tipo_cliente := 'cliente_servico';
    END;
  END IF;

  -- Cria/ativa o vínculo cliente_auth_links
  INSERT INTO public.cliente_auth_links (
    qa_cliente_id, user_id, email, documento_normalizado, status, activated_at
  ) VALUES (
    v_cliente_id, p_user_id, v_email_norm, v_cpf_norm, 'active', now()
  )
  ON CONFLICT DO NOTHING;

  -- Garante que o link esteja ativo (caso já existisse)
  UPDATE public.cliente_auth_links
     SET status = 'active',
         activated_at = COALESCE(activated_at, now()),
         updated_at = now(),
         email = COALESCE(email, v_email_norm),
         documento_normalizado = COALESCE(documento_normalizado, v_cpf_norm)
   WHERE qa_cliente_id = v_cliente_id
     AND user_id = p_user_id;

  GET DIAGNOSTICS v_link_created = ROW_COUNT;

  -- Vincula user_id direto no qa_clientes apenas se ainda não houver
  UPDATE public.qa_clientes
     SET user_id = p_user_id, updated_at = now()
   WHERE id = v_cliente_id
     AND user_id IS NULL;

  RETURN jsonb_build_object(
    'ok', true,
    'qa_cliente_id', v_cliente_id,
    'cliente_created', v_cliente_created,
    'tipo_cliente', v_tipo_cliente,
    'link_active', true
  );
END;
$$;

REVOKE ALL ON FUNCTION public.qa_cliente_criar_conta_publica(uuid, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.qa_cliente_criar_conta_publica(uuid, text, text, text, text) TO service_role;