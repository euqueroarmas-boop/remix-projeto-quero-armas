-- FIX: ao gerar checklist a partir da venda (qa_venda_to_processo), o processo
-- deve nascer já com status 'aguardando_documentos' (AGUARDANDO DOCUMENTAÇÃO)
-- e com o checklist explodido. Antes: ficava 'aguardando_pagamento' até o
-- webhook do Asaas, e o checklist só era criado em qa_confirmar_pagamento_processo.
-- O botão da UI se chama "Gerar checklist" — a expectativa do operador é
-- que o status mude imediatamente.

CREATE OR REPLACE FUNCTION public.qa_venda_to_processo(p_venda_id integer, p_servico_id integer, p_observacoes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_venda record;
  v_servico record;
  v_cliente_real_id integer;
  v_processo record;
  v_existing record;
  v_obs text;
  v_solicitacao_id uuid;
  v_solicitacao record;
  v_expected_servico_id integer;
  v_service_slug text;
  v_explode jsonb;
  v_checklist_inseridos int := 0;
  v_checklist_existentes int := 0;
BEGIN
  IF v_uid IS NULL OR NOT public.qa_is_active_staff(v_uid) THEN
    RAISE EXCEPTION 'forbidden: only active staff can convert venda to processo';
  END IF;

  IF p_venda_id IS NULL THEN RAISE EXCEPTION 'p_venda_id é obrigatório'; END IF;
  IF p_servico_id IS NULL THEN RAISE EXCEPTION 'p_servico_id é obrigatório'; END IF;

  SELECT id, cliente_id, status_validacao_valor, valor_aprovado, solicitacao_id
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

  v_solicitacao_id := v_venda.solicitacao_id;
  v_service_slug := NULL;

  IF v_solicitacao_id IS NOT NULL THEN
    SELECT id, servico_id, service_slug, status_servico
      INTO v_solicitacao
      FROM public.qa_solicitacoes_servico
     WHERE id = v_solicitacao_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'solicitação % vinculada à venda % não encontrada',
        v_solicitacao_id, p_venda_id;
    END IF;

    v_service_slug := v_solicitacao.service_slug;

    IF v_solicitacao.servico_id IS NOT NULL THEN
      v_expected_servico_id := v_solicitacao.servico_id;
    ELSE
      v_expected_servico_id := CASE LOWER(COALESCE(v_solicitacao.service_slug, ''))
        WHEN 'posse-arma-fogo'      THEN 2
        WHEN 'porte-arma-fogo'      THEN 3
        WHEN 'renovacao-arma-fogo'  THEN 26
        WHEN 'concessao-de-cr'      THEN 27
        ELSE NULL
      END;
    END IF;

    IF v_expected_servico_id IS NOT NULL
       AND v_expected_servico_id <> p_servico_id THEN
      RAISE EXCEPTION
        'INTEGRITY_SOLICITACAO_PROCESSO_MISMATCH: solicitação % (servico_id=%, slug=%) não permite gerar processo de servico_id=% (%). Posse e Porte não se misturam.',
        v_solicitacao_id,
        v_solicitacao.servico_id,
        COALESCE(v_solicitacao.service_slug, '∅'),
        p_servico_id,
        v_servico.nome_servico
      USING ERRCODE = 'check_violation';
    END IF;
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
      'pagamento_status', v_existing.pagamento_status,
      'solicitacao_id', v_existing.solicitacao_id,
      'service_slug', v_service_slug,
      'status_processo', NULL
    );
  END IF;

  v_obs := COALESCE(p_observacoes, '') ||
           CASE WHEN COALESCE(p_observacoes,'') = '' THEN '' ELSE E'\n' END ||
           '[ref] gerado da venda #' || p_venda_id::text;

  -- ✅ FIX: nasce já em 'aguardando_documentos' (AGUARDANDO DOCUMENTAÇÃO)
  -- pois o operador clicou em "Gerar checklist". Pagamento permanece
  -- 'aguardando' (será atualizado depois pelo webhook ou confirmação manual).
  INSERT INTO public.qa_processos (
    cliente_id, servico_id, venda_id, servico_nome,
    status, pagamento_status, observacoes_admin, solicitacao_id
  ) VALUES (
    v_cliente_real_id, v_servico.id, p_venda_id, v_servico.nome_servico,
    'aguardando_documentos', 'aguardando', v_obs, v_solicitacao_id
  )
  RETURNING * INTO v_processo;

  -- ✅ FIX: explode o checklist imediatamente (idempotente).
  BEGIN
    SELECT to_jsonb(t) INTO v_explode
      FROM public.qa_explodir_checklist_processo(v_processo.id) t;
    v_checklist_inseridos := COALESCE((v_explode->>'inseridos')::int, 0);
    v_checklist_existentes := COALESCE((v_explode->>'ja_existentes')::int, 0);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.qa_processo_eventos (processo_id, tipo_evento, descricao, ator)
    VALUES (v_processo.id, 'erro_checklist',
            'Falha ao explodir checklist em qa_venda_to_processo: ' || SQLERRM,
            'equipe_operacional');
  END;

  IF v_solicitacao_id IS NOT NULL THEN
    UPDATE public.qa_solicitacoes_servico
       SET status_processo = 'aberto',
           status_servico  = CASE
             WHEN status_servico IN ('aguardando_contratacao','aguardando_confirmacao','contratado')
               THEN 'em_andamento'
             ELSE status_servico
           END,
           updated_at = now()
     WHERE id = v_solicitacao_id;
  END IF;

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
      'servico_nome', v_servico.nome_servico,
      'solicitacao_id', v_solicitacao_id,
      'service_slug', v_service_slug,
      'checklist_inseridos', v_checklist_inseridos,
      'checklist_ja_existentes', v_checklist_existentes
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
      ' — serviço: ' || v_servico.nome_servico ||
      ' — checklist gerado (inseridos=' || v_checklist_inseridos ||
      ', já existentes=' || v_checklist_existentes || ')' ||
      CASE WHEN v_solicitacao_id IS NOT NULL
        THEN ' (solicitação ' || v_solicitacao_id::text || ', slug=' || COALESCE(v_service_slug,'∅') || ')'
        ELSE '' END,
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
    'pagamento_status', v_processo.pagamento_status,
    'solicitacao_id', v_processo.solicitacao_id,
    'service_slug', v_service_slug,
    'checklist_inseridos', v_checklist_inseridos,
    'checklist_ja_existentes', v_checklist_existentes,
    'status_processo', CASE WHEN v_solicitacao_id IS NOT NULL THEN 'aberto' ELSE NULL END
  );
END;
$function$;