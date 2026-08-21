-- ============================================================================
-- Libera acesso TOTAL à Área do Cliente para willmassaroto@gmail.com
-- ----------------------------------------------------------------------------
-- O acesso à Área do Cliente depende de três coisas no banco:
--   1) um cadastro ativo em qa_clientes com este e-mail (sem ele o portal
--      responde "cadastro não vinculado" e barra a entrada);
--   2) o vínculo ATIVO em cliente_auth_links entre o login e esse cadastro —
--      é ele que as regras de segurança (RLS) usam para mostrar documentos,
--      processos, vendas e contratos do próprio cliente;
--   3) assinatura vigente em qa_arsenal_assinaturas para as funções Premium
--      (Gestão de Armas e Munições, Análise de Alvo, Recarga, Klal).
--
-- Este bloco garante os três: acha (ou cria) o cadastro pelo e-mail, amarra ao
-- login existente com esse e-mail em auth.users, ativa o vínculo e concede
-- Premium por 10 anos (gratuidade, origem assinatura_direta).
--
-- Se AINDA não existir login com esse e-mail, o bloco avisa via NOTICE e deixa
-- o cadastro + Premium prontos: no primeiro acesso o portal vincula sozinho
-- pelo e-mail (qa_ensure_cliente_from_auth casa por e-mail quando há 1 único
-- cadastro).
--
-- Reexecutável.
-- ============================================================================

BEGIN;

DO $$
DECLARE
  v_email      text := 'willmassaroto@gmail.com';
  v_uid        uuid;
  v_nome       text;
  v_cliente_id integer;
  v_link_id    uuid;
  v_ass_id     uuid;
  v_hoje       date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_fim        date;
BEGIN
  v_fim := v_hoje + 3650;  -- 10 anos de Premium

  -- 1) Login (auth) deste e-mail, se já existir
  SELECT u.id,
         COALESCE(
           NULLIF(upper(u.raw_user_meta_data ->> 'nome'), ''),
           NULLIF(upper(u.raw_user_meta_data ->> 'name'), ''),
           NULLIF(upper(u.raw_user_meta_data ->> 'full_name'), ''),
           'CLIENTE PORTAL'
         )
    INTO v_uid, v_nome
    FROM auth.users u
   WHERE lower(u.email) = lower(v_email)
   ORDER BY u.created_at DESC
   LIMIT 1;

  -- 2) Cadastro em qa_clientes por e-mail (não excluído); cria se faltar.
  --    Preferência: a linha já amarrada a este login.
  SELECT c.id
    INTO v_cliente_id
    FROM public.qa_clientes c
   WHERE lower(btrim(c.email)) = lower(v_email)
     AND COALESCE(c.excluido, false) = false
   ORDER BY (v_uid IS NOT NULL AND c.user_id = v_uid) DESC,
            c.updated_at DESC NULLS LAST
   LIMIT 1;

  IF v_cliente_id IS NULL THEN
    INSERT INTO public.qa_clientes
      (nome_completo, email, user_id, status, origem, tipo_cliente)
    VALUES
      (COALESCE(v_nome, 'CLIENTE PORTAL'), lower(v_email), v_uid,
       'ATIVO', 'portal_cliente', 'cliente_app')
    RETURNING id INTO v_cliente_id;
    RAISE NOTICE 'qa_clientes: cadastro criado (id=%)', v_cliente_id;
  ELSIF v_uid IS NOT NULL THEN
    UPDATE public.qa_clientes
       SET user_id    = v_uid,
           updated_at = now()
     WHERE id = v_cliente_id
       AND user_id IS DISTINCT FROM v_uid;
    RAISE NOTICE 'qa_clientes: cadastro reaproveitado (id=%)', v_cliente_id;
  END IF;

  -- 3) Vínculo ATIVO login ↔ cadastro (chave das políticas RLS do portal).
  --    activated_at = now() garante que este vínculo vence a ordenação de
  --    qa_current_cliente_id caso existam vínculos antigos.
  IF v_uid IS NOT NULL THEN
    SELECT id INTO v_link_id
      FROM public.cliente_auth_links
     WHERE user_id = v_uid
     ORDER BY activated_at DESC NULLS LAST, created_at DESC
     LIMIT 1;

    IF v_link_id IS NULL THEN
      INSERT INTO public.cliente_auth_links
        (user_id, qa_cliente_id, email, status, activated_at)
      VALUES
        (v_uid, v_cliente_id, lower(v_email), 'active', now());
      RAISE NOTICE 'cliente_auth_links: vínculo criado e ativado';
    ELSE
      UPDATE public.cliente_auth_links
         SET qa_cliente_id = v_cliente_id,
             email         = COALESCE(NULLIF(btrim(email), ''), lower(v_email)),
             status        = 'active',
             activated_at  = now(),
             updated_at    = now()
       WHERE id = v_link_id;
      RAISE NOTICE 'cliente_auth_links: vínculo reativado e apontado para o cadastro %', v_cliente_id;
    END IF;
  ELSE
    RAISE NOTICE 'ATENÇÃO: nenhum login em auth.users com %. Crie a conta na tela de login da Área do Cliente com este e-mail; o vínculo acontece sozinho no primeiro acesso.', v_email;
  END IF;

  -- 4) Premium do Arsenal por 10 anos (destrava Gestão de Armas, Análise de
  --    Alvo, Recarga e Klal). Se já houver assinatura vigente, só estica o fim.
  SELECT id INTO v_ass_id
    FROM public.qa_arsenal_assinaturas
   WHERE cliente_id = v_cliente_id
     AND status IN ('gratuidade', 'ativa')
     AND periodo_fim >= v_hoje
   ORDER BY criado_em DESC
   LIMIT 1;

  IF v_ass_id IS NULL THEN
    INSERT INTO public.qa_arsenal_assinaturas
      (cliente_id, cpf, status, origem_gratuidade, periodo_inicio, periodo_fim, valor_anual)
    SELECT v_cliente_id,
           COALESCE(NULLIF(regexp_replace(c.cpf, '\D', '', 'g'), ''), '00000000000'),
           'gratuidade', 'assinatura_direta', v_hoje, v_fim, 297
      FROM public.qa_clientes c
     WHERE c.id = v_cliente_id
    RETURNING id INTO v_ass_id;
    RAISE NOTICE 'qa_arsenal_assinaturas: gratuidade criada até %', v_fim;
  ELSE
    UPDATE public.qa_arsenal_assinaturas
       SET periodo_fim   = GREATEST(periodo_fim, v_fim),
           atualizado_em = now()
     WHERE id = v_ass_id;
    RAISE NOTICE 'qa_arsenal_assinaturas: assinatura vigente esticada até pelo menos %', v_fim;
  END IF;

  UPDATE public.qa_clientes
     SET arsenal_plano      = 'premium',
         arsenal_status     = 'ativo',
         arsenal_upgrade_em = COALESCE(arsenal_upgrade_em, now()),
         updated_at         = now()
   WHERE id = v_cliente_id
     AND (arsenal_plano  IS DISTINCT FROM 'premium'
       OR arsenal_status IS DISTINCT FROM 'ativo'
       OR arsenal_upgrade_em IS NULL);
END $$;

COMMIT;

-- ── Conferência: deve voltar 1 linha com vínculo 'active', plano 'premium' e
--    assinatura 'gratuidade' com periodo_fim ~10 anos à frente. user_id NULO
--    aqui significa que a conta de login ainda não foi criada (ver NOTICE).
SELECT c.id            AS cliente_id,
       c.email,
       c.user_id,
       c.arsenal_plano,
       c.arsenal_status,
       l.status        AS vinculo,
       a.status        AS assinatura,
       a.periodo_fim
  FROM public.qa_clientes c
  LEFT JOIN public.cliente_auth_links l
         ON l.user_id = c.user_id AND l.status = 'active'
  LEFT JOIN public.qa_arsenal_assinaturas a
         ON a.cliente_id = c.id AND a.status IN ('gratuidade', 'ativa')
 WHERE lower(btrim(c.email)) = 'willmassaroto@gmail.com'
   AND COALESCE(c.excluido, false) = false;
