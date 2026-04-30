CREATE OR REPLACE FUNCTION public.qa_venda_to_processo(
  p_venda_id integer,
  p_servico_id integer,
  p_observacoes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_venda record;
  v_servico record;
  v_cliente_real_id integer;
  v_processo record;
  v_existing record;
  v_obs text;
BEGIN
  IF v_uid IS NULL OR NOT public.qa_is_active_staff(v_uid) THEN
    RAISE EXCEPTION 'forbidden: only active staff can convert venda to processo';
  END IF;

  IF p_venda_id IS NULL THEN RAISE EXCEPTION 'p_venda_id é obrigatório'; END IF;
  IF p_servico_id IS NULL THEN RAISE EXCEPTION 'p_servico_id é obrigatório'; END IF;

  SELECT id, cliente_id, status_validacao_valor, valor_aprovado
    INTO v_venda
    FROM public.qa_vendas
   WHERE id = p_venda_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'venda % não encontrada', p_venda_id;
  END IF;

  IF COALESCE(v_venda.status_validacao_valor, '') <> 'aprovado' THEN
    RAISE EXCEPTION 'venda % não está com valor aprovado (status=%)',
      p_venda_id, v_venda.status_validacao_valor;
  END IF;

  IF v_venda.cliente_id IS NULL THEN
    RAISE EXCEPTION 'venda % não possui cliente_id', p_venda_id;
  END IF;

  SELECT id, nome_servico INTO v_servico
    FROM public.qa_servicos WHERE id = p_servico_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'servico % não encontrado em qa_servicos', p_servico_id;
  END IF;

  v_cliente_real_id := public.qa_resolve_cliente_id_real(v_venda.cliente_id);
  IF v_cliente_real_id IS NULL THEN
    RAISE EXCEPTION 'cliente real não encontrado para cliente_id legado %', v_venda.cliente_id;
  END IF;

  SELECT * INTO v_existing
    FROM public.qa_processos
   WHERE venda_id = p_venda_id LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'ja_existia', true,
      'processo_id', v_existing.id,
      'venda_id', v_existing.venda_id,
      'cliente_id', v_existing.cliente_id,
      'servico_id', v_existing.servico_id,
      'servico_nome', v_existing.servico_nome,
      'status', v_existing.status,
      'pagamento_status', v_existing.pagamento_status
    );
  END IF;

  v_obs := COALESCE(p_observacoes, '') ||
           CASE WHEN COALESCE(p_observacoes,'') = '' THEN '' ELSE E'\n' END ||
           '[ref] gerado da venda #' || p_venda_id::text;

  INSERT INTO public.qa_processos (
    cliente_id, servico_id, venda_id, servico_nome,
    status, pagamento_status, observacoes_admin
  ) VALUES (
    v_cliente_real_id, v_servico.id, p_venda_id, v_servico.nome_servico,
    'aguardando_pagamento', 'aguardando', v_obs
  )
  RETURNING * INTO v_processo;

  INSERT INTO public.qa_venda_eventos (
    venda_id, cliente_id, qa_cliente_id, tipo_evento, descricao, dados_json, ator, user_id
  ) VALUES (
    p_venda_id,
    v_venda.cliente_id,
    v_cliente_real_id,
    'processo_gerado_da_venda',
    'Processo ' || v_processo.id::text || ' gerado para serviço ' || v_servico.nome_servico,
    jsonb_build_object(
      'processo_id', v_processo.id,
      'servico_id', v_servico.id,
      'servico_nome', v_servico.nome_servico
    ),
    'equipe_operacional',
    v_uid
  );

  INSERT INTO public.qa_processo_eventos (
    processo_id, tipo_evento, descricao, ator
  ) VALUES (
    v_processo.id,
    'processo_criado_de_venda',
    'Processo criado a partir da venda #' || p_venda_id::text ||
      ' — serviço: ' || v_servico.nome_servico,
    'equipe_operacional'
  );

  RETURN jsonb_build_object(
    'ja_existia', false,
    'processo_id', v_processo.id,
    'venda_id', v_processo.venda_id,
    'cliente_id', v_processo.cliente_id,
    'servico_id', v_processo.servico_id,
    'servico_nome', v_processo.servico_nome,
    'status', v_processo.status,
    'pagamento_status', v_processo.pagamento_status
  );
END;
$$;