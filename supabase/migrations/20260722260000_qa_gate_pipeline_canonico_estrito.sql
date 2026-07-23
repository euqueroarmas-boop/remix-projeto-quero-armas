-- Pipeline canônico ESTRITO: checklist só materializa quando os 3 estão OK:
--   1. pagamento_status = 'confirmado' na venda
--   2. contrato validated na venda
--   3. procuração validated ou reaproveitada no cliente
--
-- Duas vias populam qa_processo_documentos hoje:
--   A) qa_confirmar_pagamento_processo (chamada por webhook Asaas, botão
--      admin, Central de Adesão) — já tem gate de contrato validated.
--      Adiciona gate de procuração aqui.
--   B) Trigger qa_dispatch_explodir_apos_contrato_procuracao (Peça 3 do
--      commit anterior) — só checa contrato+procuração, faltava pagamento.
--      Adiciona gate de pagamento_status='confirmado'.
--
-- Depois desta migration, NENHUMA via popula checklist antes dos 3.

-- ─── A) qa_confirmar_pagamento_processo com gate de procuração ─────────────
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
  v_cliente_id integer;
  v_has_validated_contract boolean;
  v_has_valid_procuracao boolean;
BEGIN
  IF p_processo_id IS NULL THEN
    RAISE EXCEPTION 'p_processo_id é obrigatório';
  END IF;

  SELECT id, status, pagamento_status, venda_id::text, cliente_id
    INTO v_proc
    FROM public.qa_processos
   WHERE id = p_processo_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Processo % não encontrado', p_processo_id USING ERRCODE = 'P0002';
  END IF;

  v_venda_id := v_proc.venda_id;
  v_cliente_id := v_proc.cliente_id;

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

  -- Guarda de idempotência (mantida da versão anterior)
  IF v_proc.pagamento_status = 'confirmado'
     AND v_proc.status NOT IN ('aguardando_pagamento', 'aguardando_assinatura')
     AND p_bypass_contrato_validado IS NOT TRUE
     AND EXISTS (
       SELECT 1 FROM public.qa_processo_documentos
        WHERE processo_id = p_processo_id
     )
  THEN
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

  -- ── GATE CANÔNICO: contrato validated + procuração validated/reaproveitada ─
  IF p_origem <> 'contrato_validado' AND p_bypass_contrato_validado IS NOT TRUE THEN
    -- Contrato
    IF v_venda_id IS NULL THEN
      v_has_validated_contract := false;
    ELSE
      SELECT EXISTS (
        SELECT 1 FROM public.qa_contracts c
         WHERE c.status = 'validated' AND c.venda_id::text = v_venda_id
      ) INTO v_has_validated_contract;
    END IF;

    -- Procuração
    IF v_cliente_id IS NULL THEN
      v_has_valid_procuracao := false;
    ELSE
      SELECT EXISTS (
        SELECT 1 FROM public.qa_procuracoes p
         WHERE p.cliente_id = v_cliente_id
           AND p.status IN ('validated', 'reaproveitada')
      ) INTO v_has_valid_procuracao;
    END IF;

    -- Se qualquer um falta → marca pagamento como confirmado mas NÃO explode
    IF v_has_validated_contract IS NOT TRUE OR v_has_valid_procuracao IS NOT TRUE THEN
      UPDATE public.qa_processos
         SET pagamento_status = 'confirmado',
             status = CASE
                        WHEN status IN ('aguardando_pagamento') THEN 'aguardando_assinatura'
                        ELSE status
                      END
       WHERE id = p_processo_id
       RETURNING status, pagamento_status INTO v_proc.status, v_proc.pagamento_status;

      INSERT INTO public.qa_processo_eventos (processo_id, tipo_evento, descricao, ator)
      VALUES (
        p_processo_id,
        'aguardando_documentos_formais',
        format(
          'Pagamento confirmado. Aguarda %s%s%s antes de liberar checklist. Origem=%s',
          CASE WHEN v_has_validated_contract IS NOT TRUE THEN 'contrato validado' ELSE '' END,
          CASE WHEN v_has_validated_contract IS NOT TRUE AND v_has_valid_procuracao IS NOT TRUE THEN ' e ' ELSE '' END,
          CASE WHEN v_has_valid_procuracao IS NOT TRUE THEN 'procuração validada' ELSE '' END,
          p_origem
        ),
        v_ator
      );

      RETURN jsonb_build_object(
        'processo_id', v_proc.id,
        'pagamento_status', v_proc.pagamento_status,
        'status', v_proc.status,
        'checklist_inseridos', 0,
        'checklist_ja_existentes', 0,
        'ja_estava_confirmado', false,
        'skipped', CASE
          WHEN v_has_validated_contract IS NOT TRUE AND v_has_valid_procuracao IS NOT TRUE THEN 'contract_and_procuracao_pending'
          WHEN v_has_validated_contract IS NOT TRUE THEN 'contract_not_validated'
          ELSE 'procuracao_not_validated'
        END,
        'origem', p_origem
      );
    END IF;
  END IF;

  -- Caminho canônico: pagamento + contrato + procuração OK → explode
  UPDATE public.qa_processos
     SET pagamento_status = 'confirmado',
         status = CASE
                    WHEN status IN ('aguardando_pagamento', 'aguardando_assinatura')
                      THEN 'aguardando_documentos'
                    ELSE status
                  END
   WHERE id = p_processo_id
   RETURNING status, pagamento_status INTO v_proc.status, v_proc.pagamento_status;

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

  INSERT INTO public.qa_processo_eventos (processo_id, tipo_evento, descricao, ator)
  VALUES (
    p_processo_id,
    v_tipo_evento,
    'Pipeline canônico completo (pagto+contrato+procuração). Origem=' || p_origem
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

-- ─── B) Trigger da Peça 3 recebe gate de pagamento ─────────────────────────
CREATE OR REPLACE FUNCTION public.qa_dispatch_explodir_apos_contrato_procuracao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cliente_id integer;
  v_tem_contrato_validado boolean;
  v_tem_procuracao_valida boolean;
  v_proc record;
BEGIN
  v_cliente_id := NEW.cliente_id;
  IF v_cliente_id IS NULL THEN RETURN NEW; END IF;

  IF NEW.status IS DISTINCT FROM 'validated' AND NEW.status IS DISTINCT FROM 'reaproveitada' THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.qa_contracts
    WHERE cliente_id = v_cliente_id AND status = 'validated'
  ) INTO v_tem_contrato_validado;
  IF NOT v_tem_contrato_validado THEN RETURN NEW; END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.qa_procuracoes
    WHERE cliente_id = v_cliente_id AND status IN ('validated', 'reaproveitada')
  ) INTO v_tem_procuracao_valida;
  IF NOT v_tem_procuracao_valida THEN RETURN NEW; END IF;

  -- Explode apenas processos com pagamento_status='confirmado' e ativos.
  -- Sem pagamento, não libera — mesmo com contrato+procuração OK.
  FOR v_proc IN
    SELECT p.id
    FROM public.qa_processos p
    WHERE p.cliente_id = v_cliente_id
      AND p.pagamento_status = 'confirmado'
      AND COALESCE(p.status, '') NOT IN ('cancelado', 'finalizado', 'indeferido')
  LOOP
    BEGIN
      PERFORM public.qa_explodir_checklist_processo(v_proc.id);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;
