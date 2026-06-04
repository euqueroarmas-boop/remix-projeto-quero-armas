-- Fase 10.1: RPC central de confirmação de pagamento (manual ou webhook)
CREATE OR REPLACE FUNCTION public.qa_confirmar_pagamento_processo(
  p_processo_id uuid,
  p_origem text DEFAULT 'manual_admin'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_proc record;
  v_explode jsonb;
  v_inseridos int := 0;
  v_existentes int := 0;
  v_ja_confirmado boolean := false;
  v_tipo_evento text;
  v_ator text;
BEGIN
  IF p_processo_id IS NULL THEN
    RAISE EXCEPTION 'p_processo_id é obrigatório';
  END IF;

  SELECT id, status, pagamento_status
    INTO v_proc
    FROM public.qa_processos
   WHERE id = p_processo_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Processo % não encontrado', p_processo_id USING ERRCODE = 'P0002';
  END IF;

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

  -- Registra evento de confirmação
  INSERT INTO public.qa_processo_eventos (processo_id, tipo_evento, descricao, ator)
  VALUES (
    p_processo_id,
    v_tipo_evento,
    format('Pagamento confirmado via %s. Checklist liberado (inseridos=%s, ja_existentes=%s).',
           p_origem, v_inseridos, v_existentes),
    v_ator
  );

  RETURN jsonb_build_object(
    'processo_id', p_processo_id,
    'pagamento_status', v_proc.pagamento_status,
    'status', v_proc.status,
    'checklist_inseridos', v_inseridos,
    'checklist_ja_existentes', v_existentes,
    'ja_estava_confirmado', false,
    'origem', p_origem
  );
END;
$$;

-- Apenas service_role pode invocar diretamente; equipe operacional usa via Edge Function
REVOKE ALL ON FUNCTION public.qa_confirmar_pagamento_processo(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.qa_confirmar_pagamento_processo(uuid, text) TO service_role;