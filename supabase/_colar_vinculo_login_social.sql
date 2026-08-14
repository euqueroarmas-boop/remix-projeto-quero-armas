-- =============================================================================
-- FECHA O FURO DO LOGIN SOCIAL — colar no SQL editor (Cloud → SQL editor)
--
-- Reexecutável: as duas funções são CREATE OR REPLACE, tudo num único
-- BEGIN/COMMIT. Não altera dado, só substitui as funções.
--
-- CONTEXTO
--   Cliente que entra com Google/Apple usando e-mail diferente do e-mail onde
--   recebeu o contrato não casa por nenhuma chave: o trigger tenta e-mail e
--   celular (o Google não manda telefone), e o fallback por CPF só existia na
--   tela de login, que o fluxo de redirect não percorre. Sobrava a rede final
--   `qa_ensure_cliente_from_auth`, que criava um cadastro NOVO — cliente num
--   Arsenal vazio e o cadastro verdadeiro órfão.
--
--   O redirect já foi consertado no front (QAAuthCallbackPage passou a checar
--   o vínculo antes de entrar). Este bloco fecha os outros dois lados.
-- =============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) qa_ensure_cliente_from_auth — parar de criar cadastro no escuro
--
-- Ganha `p_criar_se_nao_encontrar` (default true, então nada muda para quem já
-- chama sem o parâmetro). O portal passa false quando não tem CPF em mãos:
-- sem CPF, criar é chute, e o chute custa um cadastro duplicado.
-- Nesse caso devolve `reason: 'sem_vinculo_precisa_cpf'` e o front manda o
-- cliente informar o CPF.
--
-- O resto da função é idêntico ao original: mesma ordem de resolução
-- (auth_link → user_id → CPF → e-mail), mesmas travas de revisão manual,
-- mesmas regras de não sobrescrever dado existente.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.qa_ensure_cliente_from_auth(
  p_email    text DEFAULT NULL,
  p_cpf      text DEFAULT NULL,
  p_nome     text DEFAULT NULL,
  p_telefone text DEFAULT NULL,
  p_criar_se_nao_encontrar boolean DEFAULT true
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
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'qa_ensure_cliente_from_auth: usuário não autenticado.'
      USING ERRCODE = '28000';
  END IF;

  v_email_norm := public.qa_norm_email(p_email);
  v_cpf_norm   := public.qa_norm_doc(p_cpf);
  v_nome_norm  := NULLIF(btrim(coalesce(p_nome, '')), '');
  v_tel_norm   := NULLIF(regexp_replace(coalesce(p_telefone, ''), '[^0-9]', '', 'g'), '');

  -- (a) vínculo já existente em cliente_auth_links
  SELECT cal.qa_cliente_id INTO v_cliente_id
    FROM public.cliente_auth_links cal
   WHERE cal.user_id = v_uid AND cal.qa_cliente_id IS NOT NULL
   ORDER BY cal.activated_at DESC NULLS LAST, cal.created_at DESC
   LIMIT 1;

  IF v_cliente_id IS NOT NULL THEN
    v_matched_by := 'auth_link';
  ELSE
    -- (b) qa_clientes.user_id
    SELECT id INTO v_cliente_id
      FROM public.qa_clientes
     WHERE user_id = v_uid AND COALESCE(excluido, false) = false
     ORDER BY updated_at DESC NULLS LAST
     LIMIT 1;
    IF v_cliente_id IS NOT NULL THEN
      v_matched_by := 'qa_clientes.user_id';
    END IF;
  END IF;

  -- (c) CPF normalizado
  IF v_cliente_id IS NULL AND v_cpf_norm IS NOT NULL THEN
    SELECT COUNT(*) INTO v_match_count
      FROM public.qa_clientes
     WHERE public.qa_norm_doc(cpf) = v_cpf_norm AND COALESCE(excluido, false) = false;

    IF v_match_count = 1 THEN
      SELECT id INTO v_cliente_id
        FROM public.qa_clientes
       WHERE public.qa_norm_doc(cpf) = v_cpf_norm AND COALESCE(excluido, false) = false
       LIMIT 1;
      v_matched_by := 'cpf';
    ELSIF v_match_count > 1 THEN
      RETURN jsonb_build_object(
        'qa_cliente_id', null, 'created', false, 'linked', false,
        'needs_manual_review', true, 'reason', 'multiple_clients_by_cpf',
        'matched_by', 'cpf', 'match_count', v_match_count);
    END IF;
  END IF;

  -- (d) e-mail normalizado
  IF v_cliente_id IS NULL AND v_email_norm IS NOT NULL THEN
    SELECT COUNT(*) INTO v_match_count
      FROM public.qa_clientes
     WHERE public.qa_norm_email(email) = v_email_norm AND COALESCE(excluido, false) = false;

    IF v_match_count = 1 THEN
      SELECT id INTO v_cliente_id
        FROM public.qa_clientes
       WHERE public.qa_norm_email(email) = v_email_norm AND COALESCE(excluido, false) = false
       LIMIT 1;
      v_matched_by := 'email';
    ELSIF v_match_count > 1 THEN
      RETURN jsonb_build_object(
        'qa_cliente_id', null, 'created', false, 'linked', false,
        'needs_manual_review', true, 'reason', 'multiple_clients_by_email',
        'matched_by', 'email', 'match_count', v_match_count);
    END IF;
  END IF;

  IF v_cliente_id IS NOT NULL THEN
    SELECT user_id INTO v_cliente_user_id FROM public.qa_clientes WHERE id = v_cliente_id;

    IF v_cliente_user_id IS NOT NULL AND v_cliente_user_id <> v_uid THEN
      RETURN jsonb_build_object(
        'qa_cliente_id', v_cliente_id, 'created', false, 'linked', false,
        'needs_manual_review', true, 'reason', 'cliente_ja_vinculado_a_outro_user',
        'matched_by', v_matched_by);
    END IF;

    UPDATE public.qa_clientes
       SET user_id       = COALESCE(user_id, v_uid),
           cpf           = COALESCE(NULLIF(btrim(cpf), ''), v_cpf_norm),
           email         = COALESCE(NULLIF(btrim(email), ''), v_email_norm),
           nome_completo = CASE
                             WHEN nome_completo IS NULL OR length(btrim(nome_completo)) < 3
                               THEN COALESCE(upper(v_nome_norm), nome_completo)
                             ELSE nome_completo
                           END,
           celular       = COALESCE(NULLIF(btrim(celular), ''), v_tel_norm),
           updated_at    = now()
     WHERE id = v_cliente_id;

    v_linked := true;

  -- ── NOVA TRAVA ────────────────────────────────────────────────────────────
  ELSIF NOT p_criar_se_nao_encontrar THEN
    RETURN jsonb_build_object(
      'qa_cliente_id', null, 'created', false, 'linked', false,
      'needs_manual_review', true, 'reason', 'sem_vinculo_precisa_cpf',
      'matched_by', 'none');

  ELSE
    INSERT INTO public.qa_clientes (
      nome_completo, cpf, email, celular, user_id, status, origem, tipo_cliente
    ) VALUES (
      COALESCE(NULLIF(upper(v_nome_norm), ''), 'CLIENTE PORTAL'),
      v_cpf_norm, v_email_norm, v_tel_norm, v_uid,
      'ATIVO', 'portal_cliente', 'cliente_app'
    )
    RETURNING id INTO v_cliente_id;

    v_created    := true;
    v_linked     := true;
    v_matched_by := 'created_new';
  END IF;

  SELECT id INTO v_link_id
    FROM public.cliente_auth_links
   WHERE user_id = v_uid
   ORDER BY activated_at DESC NULLS LAST, created_at DESC
   LIMIT 1;

  IF v_link_id IS NULL THEN
    INSERT INTO public.cliente_auth_links
      (user_id, qa_cliente_id, email, documento_normalizado, status, activated_at)
    VALUES (v_uid, v_cliente_id, v_email_norm, v_cpf_norm, 'active', now());
  ELSE
    UPDATE public.cliente_auth_links
       SET qa_cliente_id         = COALESCE(qa_cliente_id, v_cliente_id),
           email                 = COALESCE(NULLIF(btrim(email), ''), v_email_norm),
           documento_normalizado = COALESCE(NULLIF(documento_normalizado, ''), v_cpf_norm),
           status                = 'active',
           activated_at          = COALESCE(activated_at, now()),
           last_login_at         = now(),
           updated_at            = now()
     WHERE id = v_link_id;
  END IF;

  RETURN jsonb_build_object(
    'qa_cliente_id', v_cliente_id, 'created', v_created, 'linked', v_linked,
    'needs_manual_review', false, 'reason', null, 'matched_by', v_matched_by);
END;
$$;

REVOKE ALL ON FUNCTION public.qa_ensure_cliente_from_auth(text, text, text, text, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.qa_ensure_cliente_from_auth(text, text, text, text, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.qa_ensure_cliente_from_auth(text, text, text, text, boolean) TO authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2) qa_vincular_por_cpf — aceitar data de nascimento como 2º fator
--
-- A trava antiga exigia que o e-mail OU o telefone do login batesse com o
-- cadastro. É a trava certa contra sequestro de cadastro alheio, mas o Google
-- não fornece telefone: o cliente legítimo com e-mail pessoal batia em
-- `contato_divergente` e ficava sem saída.
--
-- Agora a data de nascimento serve como terceira alternativa. Ela não está no
-- e-mail nem no perfil social — quem sabe é o titular. A trava continua
-- valendo: sem NENHUM dos três, não vincula.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.qa_vincular_por_cpf(
  _cpf text,
  _data_nascimento date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id      uuid := auth.uid();
  v_email        text;
  v_phone_digits text;
  v_cpf_digits   text;
  v_cliente_id   integer;
  v_cliente_email text;
  v_cliente_celular text;
  v_cliente_nasc date;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
  END IF;

  v_cpf_digits := regexp_replace(coalesce(_cpf, ''), '\D', '', 'g');
  IF length(v_cpf_digits) <> 11 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'cpf_invalido');
  END IF;

  SELECT u.email, regexp_replace(coalesce(u.phone,''), '\D', '', 'g')
    INTO v_email, v_phone_digits
  FROM auth.users u WHERE u.id = v_user_id;

  SELECT id,
         lower(coalesce(email,'')),
         regexp_replace(coalesce(celular,''),'\D','','g'),
         data_nascimento
    INTO v_cliente_id, v_cliente_email, v_cliente_celular, v_cliente_nasc
  FROM public.qa_clientes
  WHERE regexp_replace(coalesce(cpf,''),'\D','','g') = v_cpf_digits
    AND coalesce(status,'') <> 'excluido_lgpd'
  ORDER BY created_at ASC NULLS LAST
  LIMIT 1;

  IF v_cliente_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'cliente_nao_encontrado');
  END IF;

  -- Coerência: e-mail OU telefone OU data de nascimento.
  IF NOT (
       (v_email IS NOT NULL AND v_email <> '' AND v_cliente_email = lower(v_email))
    OR (v_phone_digits <> '' AND v_cliente_celular = v_phone_digits)
    OR (_data_nascimento IS NOT NULL AND v_cliente_nasc IS NOT NULL
        AND v_cliente_nasc = _data_nascimento)
  ) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'reason', CASE WHEN _data_nascimento IS NULL
                     THEN 'contato_divergente_informe_nascimento'
                     ELSE 'contato_divergente' END);
  END IF;

  INSERT INTO public.cliente_auth_links
    (qa_cliente_id, user_id, email, documento_normalizado, status, activated_at)
  VALUES
    (v_cliente_id, v_user_id, v_email, v_cpf_digits, 'active', now())
  ON CONFLICT DO NOTHING;

  UPDATE public.qa_clientes
     SET user_id = v_user_id
   WHERE id = v_cliente_id AND user_id IS NULL;

  RETURN jsonb_build_object('ok', true, 'qa_cliente_id', v_cliente_id);
END;
$$;

REVOKE ALL ON FUNCTION public.qa_vincular_por_cpf(text, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.qa_vincular_por_cpf(text, date) TO authenticated;

COMMIT;

-- CONFERÊNCIA depois de rodar (deve listar as duas assinaturas novas):
--   SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
--     FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--    WHERE n.nspname = 'public'
--      AND p.proname IN ('qa_ensure_cliente_from_auth','qa_vincular_por_cpf')
--    ORDER BY 1, 2;


-- =============================================================================
-- 3) LIMPEZA OBRIGATÓRIA — remover as assinaturas ANTIGAS
--
-- Adicionar um parâmetro com DEFAULT não substitui a função: cria uma SEGUNDA,
-- porque no Postgres a identidade da função inclui os tipos dos argumentos.
-- Ficaram duas de cada:
--     qa_ensure_cliente_from_auth(text,text,text,text)          ← antiga
--     qa_ensure_cliente_from_auth(text,text,text,text,boolean)  ← nova
--     qa_vincular_por_cpf(text)                                 ← antiga
--     qa_vincular_por_cpf(text,date)                            ← nova
--
-- Qualquer chamada com a contagem antiga de argumentos pode bater em
-- "function is not unique". O front já manda a contagem nova, mas conviver com
-- as duas é pedir para quebrar. Rode isto logo depois do bloco acima.
-- =============================================================================
BEGIN;
DROP FUNCTION IF EXISTS public.qa_ensure_cliente_from_auth(text, text, text, text);
DROP FUNCTION IF EXISTS public.qa_vincular_por_cpf(text);
COMMIT;
