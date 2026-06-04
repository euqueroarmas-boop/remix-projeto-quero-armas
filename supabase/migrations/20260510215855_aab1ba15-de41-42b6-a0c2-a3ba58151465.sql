
-- ============================================================
-- BLOCO 10 — Pass B
-- (1) Trigger: venda PAGO → invoca qa-generate-contract via pg_net
-- (2) Trigger: contrato validated → abre qa_solicitacoes_servico
--     idempotente por (cliente_id, service_slug) snapshot.
-- ============================================================

-- 1) FUNÇÃO + TRIGGER PAGO -----------------------------------------
CREATE OR REPLACE FUNCTION public.qa_vendas_after_pago_invoke_contract()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url        text := 'https://ogkltfqvzweeqkfmrzts.supabase.co/functions/v1/qa-generate-contract';
  v_anon       text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9na2x0ZnF2endlZXFrZm1yenRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4ODc4OTIsImV4cCI6MjA5MjQ2Mzg5Mn0.Bqn76pQvh5f0lfDoucMB8BAo9y3Fs4vnVslbwGg73-g';
  v_service    text;
  v_already    boolean;
BEGIN
  -- Apenas transição para PAGO
  IF NEW.status IS DISTINCT FROM 'PAGO' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'PAGO' THEN
    RETURN NEW;
  END IF;

  -- Idempotência: se já existe contrato, não dispara
  SELECT EXISTS(
    SELECT 1 FROM public.qa_contracts WHERE venda_id = NEW.id_legado
  ) INTO v_already;
  IF v_already THEN
    RETURN NEW;
  END IF;

  -- Service role do vault (necessário para autenticar contra requireAdminOrInternal)
  BEGIN
    SELECT decrypted_secret INTO v_service
      FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_service := NULL;
  END;

  BEGIN
    PERFORM net.http_post(
      url     := v_url,
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || COALESCE(v_service, v_anon),
        'apikey',        v_anon,
        'x-trigger-source', 'qa_vendas_pago_contract'
      ),
      body    := jsonb_build_object('venda_id', NEW.id_legado)
    );
  EXCEPTION WHEN OTHERS THEN
    -- nunca quebrar o fluxo de venda; apenas registrar evento
    BEGIN
      INSERT INTO public.qa_processo_eventos (processo_id, tipo_evento, descricao, ator)
      SELECT p.id, 'falha_envio_email',
             format('Falha ao disparar geração de contrato (venda #%s): %s', NEW.id_legado, SQLERRM),
             'sistema'
        FROM public.qa_processos p
       WHERE p.cliente_id = NEW.cliente_id
       LIMIT 1;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS qa_vendas_after_pago_generate_contract ON public.qa_vendas;
CREATE TRIGGER qa_vendas_after_pago_generate_contract
AFTER INSERT OR UPDATE OF status ON public.qa_vendas
FOR EACH ROW
EXECUTE FUNCTION public.qa_vendas_after_pago_invoke_contract();

-- 2) FUNÇÃO + TRIGGER LIBERAÇÃO PÓS-VALIDATED ----------------------
-- Para cada item snapshot, garante uma qa_solicitacoes_servico
-- (uma por (cliente_id, service_slug) — usa unique index manual existente).
CREATE OR REPLACE FUNCTION public.qa_contracts_after_validated_release()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item   record;
  v_count  int := 0;
BEGIN
  IF NEW.status <> 'validated' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'validated' THEN
    RETURN NEW;
  END IF;

  FOR v_item IN
    SELECT service_slug_snapshot, service_name_snapshot, service_id_snapshot,
           item_venda_id, venda_id
      FROM public.qa_contract_items
     WHERE contract_id = NEW.id
       AND service_slug_snapshot IS NOT NULL
  LOOP
    BEGIN
      INSERT INTO public.qa_solicitacoes_servico (
        cliente_id, servico_id, service_slug, service_name,
        origem, status_servico, status_financeiro, status_processo,
        venda_id, item_venda_id, observacoes
      ) VALUES (
        NEW.cliente_id, v_item.service_id_snapshot, v_item.service_slug_snapshot, v_item.service_name_snapshot,
        'contrato_validado',
        'aguardando_documentacao',
        'pago',
        'processo_nao_aberto',
        v_item.venda_id, v_item.item_venda_id,
        format('Liberado automaticamente pelo contrato %s (venda #%s).', NEW.contract_number, v_item.venda_id)
      )
      ON CONFLICT DO NOTHING;
      v_count := v_count + 1;
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public.qa_contract_events (contract_id, event_type, event_payload)
      VALUES (NEW.id, 'release_failed',
              jsonb_build_object('service_slug', v_item.service_slug_snapshot, 'erro', SQLERRM));
    END;
  END LOOP;

  INSERT INTO public.qa_contract_events (contract_id, event_type, event_payload)
  VALUES (NEW.id, 'operational_released', jsonb_build_object('itens_liberados', v_count));

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS qa_contracts_after_validated ON public.qa_contracts;
CREATE TRIGGER qa_contracts_after_validated
AFTER UPDATE OF status ON public.qa_contracts
FOR EACH ROW
EXECUTE FUNCTION public.qa_contracts_after_validated_release();
