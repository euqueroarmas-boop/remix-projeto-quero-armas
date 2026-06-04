
-- FASE 4.2-B: criar auth.user de teste controlado + qa_clientes + cliente_auth_links
-- Senha de teste fixa para validação manual: TesteFase42@QA!
DO $$
DECLARE
  v_uid uuid := gen_random_uuid();
  v_email text := 'cliente.teste.qa.fase42@queroarmas.test';
  v_pwd text := 'TesteFase42@QA!';
  v_cliente_id int;
  v_max_legado int;
BEGIN
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
    RETURN;
  END IF;

  INSERT INTO auth.users (
    instance_id, id, aud, role, email,
    encrypted_password, email_confirmed_at, recovery_sent_at,
    last_sign_in_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated', v_email,
    crypt(v_pwd, gen_salt('bf')), now(), null,
    null, '{"provider":"email","providers":["email"]}', '{"full_name":"CLIENTE TESTE QA FASE 42"}',
    now(), now(), '', '', '', ''
  );

  INSERT INTO auth.identities (
    id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
  ) VALUES (
    gen_random_uuid(), v_uid,
    jsonb_build_object('sub', v_uid::text, 'email', v_email, 'email_verified', true),
    'email', v_uid::text, now(), now(), now()
  );

  -- Cria qa_clientes mínimo
  SELECT COALESCE(MAX(id_legado), 0) + 1 INTO v_max_legado FROM qa_clientes;
  INSERT INTO qa_clientes (id_legado, nome_completo, email, cpf, user_id)
  VALUES (v_max_legado, 'CLIENTE TESTE QA FASE 42', v_email, '00000000191', v_uid)
  RETURNING id INTO v_cliente_id;

  -- Vincula em cliente_auth_links
  INSERT INTO cliente_auth_links (user_id, qa_cliente_id, activated_at)
  VALUES (v_uid, v_cliente_id, now());

  RAISE NOTICE 'Cliente teste criado: uid=% qa_cliente_id=%', v_uid, v_cliente_id;
END $$;
