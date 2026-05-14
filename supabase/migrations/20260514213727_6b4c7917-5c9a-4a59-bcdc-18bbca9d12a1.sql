-- FASE 2C-7.2 — Endurecimento: trigger envia x-internal-token (QA_CONTRACT_RELEASE_TOKEN)
-- O header x-trigger-source permanece apenas como metadado de auditoria.
-- Token é lido do Vault (vault.decrypted_secrets), populado via secret QA_CONTRACT_RELEASE_TOKEN.

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
          jsonb_build_object('fase', '2C-7.2'));

  SELECT id, status, cobranca_status INTO v_venda
    FROM public.qa_vendas WHERE id = NEW.venda_id;

  IF NOT FOUND
     OR upper(btrim(v_venda.status)) <> 'PAGO'
     OR v_venda.cobranca_status IS DISTINCT FROM 'confirmada' THEN
    INSERT INTO public.qa_contract_events (contract_id, event_type, event_payload)
    VALUES (NEW.id, 'liberacao_recusada_pagamento_invalido',
            jsonb_build_object('venda_id', NEW.venda_id,
                               'venda_status', COALESCE(v_venda.status, 'NULL'),
                               'cobranca_status', COALESCE(v_venda.cobranca_status, 'NULL')));
    RETURN NEW;
  END IF;

  -- Lê token interno do Vault (popular via secret QA_CONTRACT_RELEASE_TOKEN).
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
            jsonb_build_object('motivo', 'qa_contract_release_token_ausente_no_vault'));
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
        'venda_id', NEW.venda_id,
        'origem_trigger', 'qa_contracts_validated'
      )
    ) INTO v_request_id;

    INSERT INTO public.qa_contract_events (contract_id, event_type, event_payload)
    VALUES (NEW.id, 'liberacao_operacional_disparada',
            jsonb_build_object('request_id', v_request_id, 'auth', 'x-internal-token'));
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.qa_contract_events (contract_id, event_type, event_payload)
    VALUES (NEW.id, 'liberacao_falhou',
            jsonb_build_object('motivo', 'pg_net_exception', 'erro', SQLERRM));
  END;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS qa_contracts_after_validated ON public.qa_contracts;
CREATE TRIGGER qa_contracts_after_validated
AFTER UPDATE OF status ON public.qa_contracts
FOR EACH ROW
EXECUTE FUNCTION public.qa_contracts_after_validated_release();