CREATE OR REPLACE FUNCTION public.qa_atualizar_status_homologacao_cliente(
  p_cliente_id integer,
  p_status text,
  p_observacao text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cli           record;
  v_status_norm   text;
  v_obs_norm      text;
  v_evento_recente record;
  v_new_recad     text;
BEGIN
  IF p_cliente_id IS NULL THEN
    RAISE EXCEPTION 'cliente_id obrigatório';
  END IF;

  v_status_norm := lower(btrim(coalesce(p_status, '')));
  IF v_status_norm NOT IN ('pendente','em_revisao','aguardando_documentos','documentos_enviados','homologado') THEN
    RAISE EXCEPTION 'Status inválido: %', p_status;
  END IF;

  v_obs_norm := NULLIF(btrim(coalesce(p_observacao, '')), '');

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
  IF v_cli.tipo_cliente = 'cliente_app' THEN
    RAISE EXCEPTION 'Cliente_app não deve ser marcado como legado.';
  END IF;

  -- Delega para qa_homologar_cliente quando for homologação final
  IF v_status_norm = 'homologado' THEN
    RETURN public.qa_homologar_cliente(p_cliente_id, v_obs_norm);
  END IF;

  -- Idempotência: se status atual = novo status e o último evento do mesmo tipo
  -- tem a mesma observação, retorna ja_estava sem duplicar evento.
  IF COALESCE(v_cli.homologacao_status, 'pendente') = v_status_norm THEN
    SELECT descricao INTO v_evento_recente
      FROM public.qa_cliente_homologacao_eventos
     WHERE qa_cliente_id = p_cliente_id
       AND tipo_evento = 'status_homologacao_alterado'
       AND (dados_json->>'novo_status') = v_status_norm
     ORDER BY created_at DESC
     LIMIT 1;
    IF FOUND AND COALESCE(v_evento_recente.descricao, '') = COALESCE(v_obs_norm, '') THEN
      RETURN jsonb_build_object(
        'ok', true,
        'ja_estava', true,
        'cliente_id', p_cliente_id,
        'status', v_status_norm
      );
    END IF;
  END IF;

  v_new_recad := CASE v_status_norm
    WHEN 'aguardando_documentos' THEN 'aguardando_documentos'
    WHEN 'documentos_enviados'   THEN 'documentos_enviados'
    ELSE v_cli.recadastramento_status
  END;

  UPDATE public.qa_clientes
     SET homologacao_status     = v_status_norm,
         recadastramento_status = v_new_recad
   WHERE id = p_cliente_id;

  INSERT INTO public.qa_cliente_homologacao_eventos (
    qa_cliente_id, tipo_evento, ator, descricao, dados_json
  ) VALUES (
    p_cliente_id,
    'status_homologacao_alterado',
    'staff',
    v_obs_norm,
    jsonb_build_object(
      'status_anterior', COALESCE(v_cli.homologacao_status, 'pendente'),
      'novo_status', v_status_norm,
      'recadastramento_status', v_new_recad,
      'origem', 'fase_20_e'
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'ja_estava', false,
    'cliente_id', p_cliente_id,
    'status', v_status_norm
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.qa_atualizar_status_homologacao_cliente(integer, text, text) TO authenticated, service_role;