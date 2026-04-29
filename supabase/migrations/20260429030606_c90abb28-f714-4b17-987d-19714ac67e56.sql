
-- ============================================================================
-- FASE 2 — FUNDAÇÃO DE IDENTIDADE
-- Nada de backfill. Nada de armas. Nada de UI. Só identidade.
-- ============================================================================

-- 1) Colunas mínimas em qa_clientes (idempotente)
ALTER TABLE public.qa_clientes
  ADD COLUMN IF NOT EXISTS origem        text,
  ADD COLUMN IF NOT EXISTS tipo_cliente  text DEFAULT 'cliente_servico';

-- 2) Função canônica de garantia de cliente a partir do usuário autenticado
CREATE OR REPLACE FUNCTION public.qa_ensure_cliente_from_auth(
  p_email    text DEFAULT NULL,
  p_cpf      text DEFAULT NULL,
  p_nome     text DEFAULT NULL,
  p_telefone text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_uid              uuid := auth.uid();
  v_email_norm       text;
  v_cpf_norm         text;
  v_nome_norm        text;
  v_tel_norm         text;
  v_match_count      integer := 0;
  v_cliente_id       integer;
  v_cliente_user_id  uuid;
  v_matched_by       text := 'none';
  v_created          boolean := false;
  v_linked           boolean := false;
  v_link_id          uuid;
BEGIN
  -- Trava de segurança: jamais aceitar user_id do client; só auth.uid().
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'qa_ensure_cliente_from_auth: usuário não autenticado.'
      USING ERRCODE = '28000';
  END IF;

  v_email_norm := public.qa_norm_email(p_email);
  v_cpf_norm   := public.qa_norm_doc(p_cpf);
  v_nome_norm  := NULLIF(btrim(coalesce(p_nome, '')), '');
  v_tel_norm   := NULLIF(regexp_replace(coalesce(p_telefone, ''), '[^0-9]', '', 'g'), '');

  -- (a) vínculo já existente em cliente_auth_links
  SELECT cal.qa_cliente_id
    INTO v_cliente_id
    FROM public.cliente_auth_links cal
   WHERE cal.user_id = v_uid
     AND cal.qa_cliente_id IS NOT NULL
   ORDER BY cal.activated_at DESC NULLS LAST, cal.created_at DESC
   LIMIT 1;

  IF v_cliente_id IS NOT NULL THEN
    v_matched_by := 'auth_link';
  ELSE
    -- (b) qa_clientes.user_id
    SELECT id
      INTO v_cliente_id
      FROM public.qa_clientes
     WHERE user_id = v_uid
       AND COALESCE(excluido, false) = false
     ORDER BY updated_at DESC NULLS LAST
     LIMIT 1;

    IF v_cliente_id IS NOT NULL THEN
      v_matched_by := 'qa_clientes.user_id';
    END IF;
  END IF;

  -- (c) CPF normalizado — só se ainda sem match
  IF v_cliente_id IS NULL AND v_cpf_norm IS NOT NULL THEN
    SELECT COUNT(*) INTO v_match_count
      FROM public.qa_clientes
     WHERE public.qa_norm_doc(cpf) = v_cpf_norm
       AND COALESCE(excluido, false) = false;

    IF v_match_count = 1 THEN
      SELECT id INTO v_cliente_id
        FROM public.qa_clientes
       WHERE public.qa_norm_doc(cpf) = v_cpf_norm
         AND COALESCE(excluido, false) = false
       LIMIT 1;
      v_matched_by := 'cpf';
    ELSIF v_match_count > 1 THEN
      RETURN jsonb_build_object(
        'qa_cliente_id', null,
        'created', false,
        'linked', false,
        'needs_manual_review', true,
        'reason', 'multiple_clients_by_cpf',
        'matched_by', 'cpf',
        'match_count', v_match_count
      );
    END IF;
  END IF;

  -- (d) e-mail normalizado — só se ainda sem match
  IF v_cliente_id IS NULL AND v_email_norm IS NOT NULL THEN
    SELECT COUNT(*) INTO v_match_count
      FROM public.qa_clientes
     WHERE public.qa_norm_email(email) = v_email_norm
       AND COALESCE(excluido, false) = false;

    IF v_match_count = 1 THEN
      SELECT id INTO v_cliente_id
        FROM public.qa_clientes
       WHERE public.qa_norm_email(email) = v_email_norm
         AND COALESCE(excluido, false) = false
       LIMIT 1;
      v_matched_by := 'email';
    ELSIF v_match_count > 1 THEN
      RETURN jsonb_build_object(
        'qa_cliente_id', null,
        'created', false,
        'linked', false,
        'needs_manual_review', true,
        'reason', 'multiple_clients_by_email',
        'matched_by', 'email',
        'match_count', v_match_count
      );
    END IF;
  END IF;

  -- ============================================================
  -- Achou cliente: reutiliza com regras de NÃO sobrescrever
  -- ============================================================
  IF v_cliente_id IS NOT NULL THEN
    SELECT user_id INTO v_cliente_user_id
      FROM public.qa_clientes WHERE id = v_cliente_id;

    -- Conflito: cliente já está vinculado a OUTRO usuário → revisão manual
    IF v_cliente_user_id IS NOT NULL AND v_cliente_user_id <> v_uid THEN
      RETURN jsonb_build_object(
        'qa_cliente_id', v_cliente_id,
        'created', false,
        'linked', false,
        'needs_manual_review', true,
        'reason', 'cliente_ja_vinculado_a_outro_user',
        'matched_by', v_matched_by
      );
    END IF;

    UPDATE public.qa_clientes
       SET user_id        = COALESCE(user_id, v_uid),
           cpf            = COALESCE(NULLIF(btrim(cpf), ''), v_cpf_norm),
           email          = COALESCE(NULLIF(btrim(email), ''), v_email_norm),
           nome_completo  = CASE
                              WHEN nome_completo IS NULL OR length(btrim(nome_completo)) < 3
                                   THEN COALESCE(upper(v_nome_norm), nome_completo)
                              ELSE nome_completo
                            END,
           celular        = COALESCE(NULLIF(btrim(celular), ''), v_tel_norm),
           updated_at     = now()
     WHERE id = v_cliente_id;

    v_linked := true;
  ELSE
    -- ============================================================
    -- Não achou: cria cliente_app
    -- ============================================================
    INSERT INTO public.qa_clientes (
      nome_completo, cpf, email, celular,
      user_id, status, origem, tipo_cliente
    ) VALUES (
      COALESCE(NULLIF(upper(v_nome_norm), ''), 'CLIENTE PORTAL'),
      v_cpf_norm,
      v_email_norm,
      v_tel_norm,
      v_uid,
      'ATIVO',
      'portal_cliente',
      'cliente_app'
    )
    RETURNING id INTO v_cliente_id;

    v_created    := true;
    v_linked     := true;
    v_matched_by := 'created_new';
  END IF;

  -- ============================================================
  -- Garante cliente_auth_links 'active'
  -- ============================================================
  SELECT id INTO v_link_id
    FROM public.cliente_auth_links
   WHERE user_id = v_uid
   ORDER BY activated_at DESC NULLS LAST, created_at DESC
   LIMIT 1;

  IF v_link_id IS NULL THEN
    INSERT INTO public.cliente_auth_links (
      user_id, qa_cliente_id, email, documento_normalizado,
      status, activated_at
    ) VALUES (
      v_uid,
      v_cliente_id,
      v_email_norm,
      v_cpf_norm,
      'active',
      now()
    );
  ELSE
    UPDATE public.cliente_auth_links
       SET qa_cliente_id          = COALESCE(qa_cliente_id, v_cliente_id),
           email                  = COALESCE(NULLIF(btrim(email), ''), v_email_norm),
           documento_normalizado  = COALESCE(NULLIF(documento_normalizado, ''), v_cpf_norm),
           status                 = 'active',
           activated_at           = COALESCE(activated_at, now()),
           last_login_at          = now(),
           updated_at             = now()
     WHERE id = v_link_id;
  END IF;

  RETURN jsonb_build_object(
    'qa_cliente_id',       v_cliente_id,
    'created',             v_created,
    'linked',              v_linked,
    'needs_manual_review', false,
    'reason',              null,
    'matched_by',          v_matched_by
  );
END;
$$;

-- 3) Permissões: somente authenticated (anon explicitamente revogado)
REVOKE ALL ON FUNCTION public.qa_ensure_cliente_from_auth(text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.qa_ensure_cliente_from_auth(text, text, text, text) FROM anon;
GRANT  EXECUTE ON FUNCTION public.qa_ensure_cliente_from_auth(text, text, text, text) TO authenticated;

COMMENT ON FUNCTION public.qa_ensure_cliente_from_auth(text, text, text, text) IS
  'Fase 2 — Fundação de identidade. Garante vínculo entre auth.uid() e qa_clientes/cliente_auth_links. NUNCA aceita user_id do frontend; usa apenas auth.uid().';
