DO $do$
DECLARE
  d text;
  antigo text := 'GREATEST(pb.created_at, COALESCE(dt.ultimo_envio,pb.created_at), COALESCE(dt.ultima_mudanca,pb.created_at), COALESCE(ec.efetiva_updated_at,pb.created_at), COALESCE(ci.ultima_ciencia,pb.created_at)) AS ultima_atividade';
  novo text := 'GREATEST(pb.created_at, COALESCE(dt.ultimo_envio,pb.created_at), COALESCE(ec.efetiva_updated_at,pb.created_at), COALESCE(ci.ultima_ciencia,pb.created_at), COALESCE(ac.ultimo_acesso,pb.created_at)) AS ultima_atividade';
BEGIN
  SELECT pg_get_functiondef(oid) INTO d FROM pg_proc WHERE proname='qa_painel_progresso_clientes' AND pronamespace='public'::regnamespace;
  IF d IS NULL THEN RAISE EXCEPTION 'funcao nao encontrada'; END IF;
  IF position(antigo in d) = 0 THEN RAISE EXCEPTION 'expressao de ultima_atividade nao encontrada'; END IF;
  d := replace(d, antigo, novo);
  EXECUTE d;
END
$do$;