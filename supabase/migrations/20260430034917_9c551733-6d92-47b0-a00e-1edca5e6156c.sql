CREATE OR REPLACE FUNCTION public.qa_homologar_cliente(p_cliente_id integer, p_observacao text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_caller uuid := auth.uid();
  v_cliente record;
  v_status_anterior text;
  v_evt_existente boolean;
BEGIN
  IF v_caller IS NULL OR NOT public.qa_is_active_staff(v_caller) THEN
    RAISE EXCEPTION 'forbidden: apenas equipe operacional pode homologar clientes'
      USING ERRCODE = '42501';
  END IF;

  SELECT id, nome_completo, homologacao_status, status, cliente_legado, excluido
    INTO v_cliente
    FROM public.qa_clientes
   WHERE id = p_cliente_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'cliente_nao_encontrado: id=%', p_cliente_id
      USING ERRCODE = 'P0002';
  END IF;

  IF COALESCE(v_cliente.excluido, false) = true OR v_cliente.status = 'excluido_lgpd' THEN
    RAISE EXCEPTION 'cliente_excluido_lgpd: id=%', p_cliente_id
      USING ERRCODE = '22023';
  END IF;

  IF v_cliente.homologacao_status = 'homologado' THEN
    RETURN jsonb_build_object(
      'ok', true,
      'ja_estava_homologado', true,
      'cliente_id', p_cliente_id
    );
  END IF;

  v_status_anterior := COALESCE(v_cliente.homologacao_status, 'pendente');

  UPDATE public.qa_clientes
     SET homologacao_status = 'homologado',
         homologado_em = now(),
         homologado_por = v_caller,
         homologacao_observacoes = p_observacao,
         recadastramento_obrigatorio = false,
         recadastramento_status = 'dispensado_por_homologacao_manual'
   WHERE id = p_cliente_id;

  SELECT EXISTS (
    SELECT 1 FROM public.qa_cliente_homologacao_eventos
     WHERE qa_cliente_id = p_cliente_id
       AND tipo_evento = 'cliente_homologado'
  ) INTO v_evt_existente;

  IF NOT v_evt_existente THEN
    INSERT INTO public.qa_cliente_homologacao_eventos (
      qa_cliente_id, tipo_evento, ator, user_id, descricao, dados_json
    ) VALUES (
      p_cliente_id,
      'cliente_homologado',
      'equipe_operacional',
      v_caller,
      'Cliente legado homologado manualmente pela Equipe Operacional.',
      jsonb_build_object(
        'observacao', p_observacao,
        'status_anterior', v_status_anterior,
        'origem', 'fase_20_c'
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'ja_estava_homologado', false,
    'cliente_id', p_cliente_id,
    'status_anterior', v_status_anterior
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.qa_reabrir_homologacao_cliente(p_cliente_id integer, p_motivo text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_caller uuid := auth.uid();
  v_cliente record;
  v_status_anterior text;
BEGIN
  IF v_caller IS NULL OR NOT public.qa_is_active_staff(v_caller) THEN
    RAISE EXCEPTION 'forbidden: apenas equipe operacional pode reabrir homologação'
      USING ERRCODE = '42501';
  END IF;

  IF p_motivo IS NULL OR length(btrim(p_motivo)) < 5 THEN
    RAISE EXCEPTION 'motivo_obrigatorio: informe um motivo com pelo menos 5 caracteres'
      USING ERRCODE = '22023';
  END IF;

  SELECT id, homologacao_status, status, excluido
    INTO v_cliente
    FROM public.qa_clientes
   WHERE id = p_cliente_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'cliente_nao_encontrado: id=%', p_cliente_id
      USING ERRCODE = 'P0002';
  END IF;

  v_status_anterior := COALESCE(v_cliente.homologacao_status, 'pendente');

  UPDATE public.qa_clientes
     SET homologacao_status = 'em_revisao',
         recadastramento_obrigatorio = true,
         recadastramento_status = 'reaberto_pela_equipe'
   WHERE id = p_cliente_id;

  INSERT INTO public.qa_cliente_homologacao_eventos (
    qa_cliente_id, tipo_evento, ator, user_id, descricao, dados_json
  ) VALUES (
    p_cliente_id,
    'homologacao_reaberta',
    'equipe_operacional',
    v_caller,
    'Homologação reaberta pela Equipe Operacional.',
    jsonb_build_object(
      'motivo', p_motivo,
      'status_anterior', v_status_anterior,
      'origem', 'fase_20_c'
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'cliente_id', p_cliente_id,
    'status_anterior', v_status_anterior
  );
END;
$function$;