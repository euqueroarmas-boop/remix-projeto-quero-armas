CREATE OR REPLACE FUNCTION public.qa_confirmar_pagamento_processo(
  p_processo_id uuid,
  p_origem text DEFAULT 'manual_admin'::text,
  p_bypass_contrato_validado boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_proc record;
  v_explode jsonb;
  v_inseridos int := 0;
  v_existentes int := 0;
  v_ja_confirmado boolean := false;
  v_tipo_evento text;
  v_ator text;
  v_venda_id text;
  v_has_validated_contract boolean;
BEGIN
  IF p_processo_id IS NULL THEN
    RAISE EXCEPTION 'p_processo_id é obrigatório';
  END IF;

  SELECT id, status, pagamento_status, venda_id::text
    INTO v_proc
    FROM public.qa_processos
   WHERE id = p_processo_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Processo % não encontrado', p_processo_id USING ERRCODE = 'P0002';
  END IF;

  v_venda_id := v_proc.venda_id;

  -- Resolver tipo de evento conforme origem
  IF p_origem = 'asaas_webhook' THEN
    v_tipo_evento := 'pagamento_confirmado_webhook';
    v_ator := 'sistema';
  ELSIF p_origem = 'manual_admin' THEN
    v_tipo_evento := 'pagamento_confirmado_manual';
    v_ator := 'equipe_operacional';
  ELSE
    v_tipo_evento := 'pagamento_confirmado_' || p_origem;
    v_ator := 'sistema';
  END IF;

  -- Idempotência: já estava confirmado?
  IF v_proc.pagamento_status = 'confirmado' THEN
    v_ja_confirmado := true;
    RETURN jsonb_build_object(
      'processo_id', v_proc.id,
      'pagamento_status', v_proc.pagamento_status,
      'status', v_proc.status,
      'checklist_inseridos', 0,
      'checklist_ja_existentes', 0,
      'ja_estava_confirmado', true,
      'origem', p_origem
    );
  END IF;

  -- ── GATE DE CONTRATO ASSINADO ────────────────────────────────────────
  -- Regra: só promove o processo (status + checklist) se houver contrato
  -- validated para a mesma venda. Origens canônicas que já fizeram esse
  -- gate upstream ('contrato_validado') passam direto. Equipe pode forçar
  -- com p_bypass_contrato_validado=true (registrado em auditoria).
  IF p_origem <> 'contrato_validado' AND p_bypass_contrato_validado IS NOT TRUE THEN
    IF v_venda_id IS NULL THEN
      v_has_validated_contract := false;
    ELSE
      SELECT EXISTS (
        SELECT 1
          FROM public.qa_contracts c
         WHERE c.status = 'validated'
           AND (c.venda_id::text = v_venda_id)
      ) INTO v_has_validated_contract;
    END IF;

    IF v_has_validated_contract IS NOT TRUE THEN
      INSERT INTO public.qa_processo_eventos (processo_id, tipo_evento, descricao, ator)
      VALUES (
        p_processo_id,
        'liberacao_bloqueada_contrato_nao_assinado',
        'Promoção bloqueada: contrato da venda ainda não está validated. Origem=' || p_origem,
        v_ator
      );
      RETURN jsonb_build_object(
        'processo_id', v_proc.id,
        'pagamento_status', v_proc.pagamento_status,
        'status', v_proc.status,
        'checklist_inseridos', 0,
        'checklist_ja_existentes', 0,
        'ja_estava_confirmado', false,
        'skipped', 'contract_not_validated',
        'origem', p_origem
      );
    END IF;
  END IF;
  -- ─────────────────────────────────────────────────────────────────────

  -- Atualiza status do processo
  UPDATE public.qa_processos
     SET pagamento_status = 'confirmado',
         status = CASE WHEN status = 'aguardando_pagamento' THEN 'aguardando_documentos' ELSE status END
   WHERE id = p_processo_id
   RETURNING status, pagamento_status INTO v_proc.status, v_proc.pagamento_status;

  -- Explode checklist (idempotente)
  BEGIN
    SELECT to_jsonb(t) INTO v_explode
      FROM public.qa_explodir_checklist_processo(p_processo_id) t;
    v_inseridos := COALESCE((v_explode->>'inseridos')::int, 0);
    v_existentes := COALESCE((v_explode->>'ja_existentes')::int, 0);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.qa_processo_eventos (processo_id, tipo_evento, descricao, ator)
    VALUES (p_processo_id, 'erro_checklist',
            'Falha ao explodir checklist em confirmar_pagamento: ' || SQLERRM, v_ator);
  END;

  -- Evento de auditoria
  INSERT INTO public.qa_processo_eventos (processo_id, tipo_evento, descricao, ator)
  VALUES (
    p_processo_id,
    v_tipo_evento,
    'Pagamento confirmado e checklist explodido. Origem=' || p_origem
      || CASE WHEN p_bypass_contrato_validado THEN ' (BYPASS_CONTRATO)' ELSE '' END,
    v_ator
  );

  RETURN jsonb_build_object(
    'processo_id', v_proc.id,
    'pagamento_status', v_proc.pagamento_status,
    'status', v_proc.status,
    'checklist_inseridos', v_inseridos,
    'checklist_ja_existentes', v_existentes,
    'ja_estava_confirmado', v_ja_confirmado,
    'origem', p_origem
  );
END;
$function$;