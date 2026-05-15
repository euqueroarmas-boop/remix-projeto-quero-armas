-- FASE 2C-9.1 (parte 2) — corrige vínculo id vs id_legado também na trigger
-- de liberação operacional. Mesma convenção do módulo Quero Armas:
-- qa_contracts.venda_id armazena qa_vendas.id_legado.

CREATE OR REPLACE FUNCTION public.qa_contracts_after_validated_release()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_request_id bigint;
  v_function_url text := 'https://ogkltfqvzweeqkfmrzts.supabase.co/functions/v1/qa-liberar-servicos-contrato';
  v_anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9na2x0ZnF2endlZXFrZm1yenRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4ODc4OTIsImV4cCI6MjA5MjQ2Mzg5Mn0.Bqn76pQvh5f0lfDoucMB8BAo9y3Fs4vnVslbwGg73-g';
  v_internal_token text;
  v_venda record;
BEGIN
  IF NEW.status <> 'validated' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'validated' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.qa_contract_events (contract_id, event_type, event_payload)
  VALUES (NEW.id, 'contrato_assinado_apto_para_liberacao',
          jsonb_build_object('fase', '2C-7.2',
                             'contract_venda_id', NEW.venda_id));

  -- FASE 2C-9.1: resolve venda preferindo id_legado (convenção do módulo),
  -- com fallback ao id real. Não afrouxa regra financeira.
  SELECT id, id_legado, status, cobranca_status, cliente_id INTO v_venda
    FROM public.qa_vendas
   WHERE id_legado = NEW.venda_id
   LIMIT 1;

  IF NOT FOUND THEN
    SELECT id, id_legado, status, cobranca_status, cliente_id INTO v_venda
      FROM public.qa_vendas
     WHERE id = NEW.venda_id
     LIMIT 1;
  END IF;

  IF NOT FOUND THEN
    INSERT INTO public.qa_contract_events (contract_id, event_type, event_payload)
    VALUES (NEW.id, 'liberacao_recusada_venda_nao_encontrada',
            jsonb_build_object('contract_venda_id', NEW.venda_id));
    RETURN NEW;
  END IF;

  IF upper(btrim(v_venda.status)) <> 'PAGO'
     OR v_venda.cobranca_status IS DISTINCT FROM 'confirmada' THEN
    INSERT INTO public.qa_contract_events (contract_id, event_type, event_payload)
    VALUES (NEW.id, 'liberacao_recusada_pagamento_invalido',
            jsonb_build_object('venda_id_real', v_venda.id,
                               'venda_id_legado', v_venda.id_legado,
                               'contract_venda_id', NEW.venda_id,
                               'venda_status', COALESCE(v_venda.status, 'NULL'),
                               'cobranca_status', COALESCE(v_venda.cobranca_status, 'NULL')));
    RETURN NEW;
  END IF;

  -- Token interno do Vault.
  BEGIN
    SELECT decrypted_secret INTO v_internal_token
      FROM vault.decrypted_secrets
     WHERE name = 'QA_CONTRACT_RELEASE_TOKEN'
     LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_internal_token := NULL;
  END;

  IF v_internal_token IS NULL OR length(v_internal_token) < 16 THEN
    INSERT INTO public.qa_contract_events (contract_id, event_type, event_payload)
    VALUES (NEW.id, 'liberacao_falhou',
            jsonb_build_object('motivo', 'qa_contract_release_token_ausente_no_vault',
                               'venda_id_real', v_venda.id,
                               'venda_id_legado', v_venda.id_legado));
    RETURN NEW;
  END IF;

  BEGIN
    SELECT net.http_post(
      url := v_function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_anon_key,
        'apikey', v_anon_key,
        'x-internal-token', v_internal_token,
        -- metadado de auditoria; NÃO autoriza sozinho na edge.
        'x-trigger-source', 'qa_contract_validated'
      ),
      body := jsonb_build_object(
        'contract_id', NEW.id,
        'venda_id', v_venda.id_legado,           -- compat com edge atual (id_legado)
        'venda_id_real', v_venda.id,
        'venda_id_legado', v_venda.id_legado,
        'contract_venda_id', NEW.venda_id,
        'origem_trigger', 'qa_contracts_validated'
      )
    ) INTO v_request_id;

    INSERT INTO public.qa_contract_events (contract_id, event_type, event_payload)
    VALUES (NEW.id, 'liberacao_operacional_disparada',
            jsonb_build_object('request_id', v_request_id,
                               'auth', 'x-internal-token',
                               'venda_id_real', v_venda.id,
                               'venda_id_legado', v_venda.id_legado,
                               'contract_venda_id', NEW.venda_id,
                               'trigger_source', 'qa_contract_validated'));
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.qa_contract_events (contract_id, event_type, event_payload)
    VALUES (NEW.id, 'liberacao_falhou',
            jsonb_build_object('motivo', 'pg_net_exception', 'erro', SQLERRM,
                               'venda_id_real', v_venda.id,
                               'venda_id_legado', v_venda.id_legado));
  END;

  RETURN NEW;
END;
$function$;