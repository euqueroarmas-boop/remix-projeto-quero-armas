-- 1) qa_contracts: colunas de rastreio de dispositivo no upload do PDF assinado
ALTER TABLE public.qa_contracts
  ADD COLUMN IF NOT EXISTS customer_upload_ip         text,
  ADD COLUMN IF NOT EXISTS customer_upload_user_agent text,
  ADD COLUMN IF NOT EXISTS customer_upload_device     jsonb;

COMMENT ON COLUMN public.qa_contracts.customer_upload_ip         IS 'IP do cliente no momento do upload do PDF assinado (x-forwarded-for server-side)';
COMMENT ON COLUMN public.qa_contracts.customer_upload_user_agent IS 'User-Agent completo do navegador no upload do PDF assinado';
COMMENT ON COLUMN public.qa_contracts.customer_upload_device     IS 'Metadados extras de sessão: screen, timezone, language, platform';

-- 2) RPC qa_confirmar_pagamento_processo: guarda de idempotência corrigida
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

  IF p_origem <> 'contrato_validado' AND p_bypass_contrato_validado IS NOT TRUE THEN
    IF v_venda_id IS NULL THEN
      v_has_validated_contract := false;
    ELSE
      SELECT EXISTS (
        SELECT 1 FROM public.qa_contracts c
         WHERE c.status = 'validated' AND c.venda_id::text = v_venda_id
      ) INTO v_has_validated_contract;
    END IF;

    IF v_has_validated_contract IS NOT TRUE THEN
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
        'aguardando_assinatura_contrato',
        'Pagamento confirmado. Processo aguarda assinatura do contrato — checklist NÃO liberado. Origem=' || p_origem,
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

-- 3) Trigger de auditoria enriquecido em qa_processos
CREATE OR REPLACE FUNCTION public.qa_processos_log_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.qa_processo_eventos (processo_id, tipo_evento, descricao, dados_json, ator, user_id)
    VALUES (
      NEW.id,
      'processo_criado',
      'Processo criado com status=' || NEW.status || ' pagamento=' || COALESCE(NEW.pagamento_status, '?'),
      jsonb_build_object(
        'status',            NEW.status,
        'pagamento_status',  NEW.pagamento_status,
        'servico_id',        NEW.servico_id,
        'venda_id',          NEW.venda_id,
        'auth_uid',          auth.uid()
      ),
      CASE WHEN auth.uid() IS NULL THEN 'sistema' ELSE 'usuario' END,
      auth.uid()
    );

    IF NEW.pagamento_status = 'confirmado' THEN
      INSERT INTO public.qa_processo_eventos (processo_id, tipo_evento, descricao, dados_json, ator)
      VALUES (
        NEW.id,
        'processo_criado_estado_suspeito',
        'ATENÇÃO: processo criado já com pagamento_status=confirmado. '
          || 'Origem desconhecida — checklist pode não ser explodido automaticamente. '
          || 'Verifique e execute qa_explodir_checklist_processo se necessário.',
        jsonb_build_object(
          'status',           NEW.status,
          'pagamento_status', NEW.pagamento_status,
          'servico_id',       NEW.servico_id,
          'venda_id',         NEW.venda_id,
          'auth_uid',         auth.uid()
        ),
        'sistema'
      );
    END IF;

  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.qa_processo_eventos (processo_id, tipo_evento, descricao, dados_json, ator, user_id)
    VALUES (
      NEW.id,
      'status_alterado',
      'Status: ' || OLD.status || ' → ' || NEW.status,
      jsonb_build_object(
        'de',               OLD.status,
        'para',             NEW.status,
        'pagamento_status', NEW.pagamento_status,
        'venda_id',         NEW.venda_id,
        'auth_uid',         auth.uid()
      ),
      CASE WHEN auth.uid() IS NULL THEN 'sistema' ELSE 'usuario' END,
      auth.uid()
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_qa_processos_log_status ON public.qa_processos;
CREATE TRIGGER trg_qa_processos_log_status
  AFTER INSERT OR UPDATE ON public.qa_processos
  FOR EACH ROW EXECUTE FUNCTION public.qa_processos_log_status_change();