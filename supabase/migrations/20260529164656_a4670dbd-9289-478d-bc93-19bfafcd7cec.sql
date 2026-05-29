DO $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE lower(email) = 'willmassaroto@gmail.com' LIMIT 1;
  IF v_user_id IS NULL THEN
    RAISE NOTICE 'Nenhum usuário auth encontrado';
    RETURN;
  END IF;

  DELETE FROM public.cliente_auth_links WHERE user_id = v_user_id;
  DELETE FROM public.qa_usuarios_perfis WHERE user_id = v_user_id;
  DELETE FROM auth.identities WHERE user_id = v_user_id;
  DELETE FROM auth.sessions WHERE user_id = v_user_id;
  DELETE FROM auth.users WHERE id = v_user_id;

  INSERT INTO public.qa_logs_auditoria (entidade, acao, detalhes_json)
  VALUES ('auth.users', 'HOMOLOG_CLEANUP_20260529',
          jsonb_build_object('email','willmassaroto@gmail.com','user_id',v_user_id));
END $$;