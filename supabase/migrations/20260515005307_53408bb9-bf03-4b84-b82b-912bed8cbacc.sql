-- FASE 2C-9.1 — Corrigir vínculo id vs id_legado na invocação do contrato pós-pagamento.
-- A edge qa-generate-contract trabalha por id_legado (convenção do módulo Quero Armas:
-- qa_itens_venda.venda_id, qa_contracts.venda_id e qa_contract_items.venda_id usam id_legado).
-- A trigger anterior enviava NEW.id (id real), causando 404 "Venda não encontrada" na edge.

CREATE OR REPLACE FUNCTION public.qa_vendas_after_pago_invoke_contract()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_old_status text;
  v_new_status text;
  v_function_url text;
  v_anon_key text;
  v_cliente_status text;
  v_venda_ref bigint;
BEGIN
  v_new_status := upper(btrim(COALESCE(NEW.status, '')));
  v_old_status := upper(btrim(COALESCE(OLD.status, '')));

  -- Só dispara em transição "para PAGO"
  IF v_new_status <> 'PAGO' OR v_old_status = 'PAGO' THEN
    RETURN NEW;
  END IF;

  IF NEW.cliente_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- LGPD: não gerar contrato para cliente excluído logicamente
  SELECT status INTO v_cliente_status
    FROM public.qa_clientes
   WHERE id_legado = NEW.cliente_id
   LIMIT 1;
  IF v_cliente_status = 'excluido_lgpd' THEN
    RETURN NEW;
  END IF;

  -- FASE 2C-9.1: edge qa-generate-contract resolve venda/itens por id_legado.
  -- Fallback para NEW.id apenas se id_legado for nulo (compat defensiva).
  v_venda_ref := COALESCE(NEW.id_legado, NEW.id);

  v_function_url := 'https://ogkltfqvzweeqkfmrzts.supabase.co/functions/v1/qa-generate-contract';
  v_anon_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9na2x0ZnF2endlZXFrZm1yenRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4ODc4OTIsImV4cCI6MjA5MjQ2Mzg5Mn0.Bqn76pQvh5f0lfDoucMB8BAo9y3Fs4vnVslbwGg73-g';

  BEGIN
    PERFORM net.http_post(
      url := v_function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_anon_key,
        'apikey', v_anon_key,
        'x-trigger-source', 'qa_vendas_pago_contract'
      ),
      body := jsonb_build_object(
        'venda_id', v_venda_ref,
        'venda_id_real', NEW.id,
        'venda_id_legado', NEW.id_legado,
        'trigger_source', 'qa_vendas_after_pago'
      )
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'qa_vendas_after_pago_invoke_contract: net.http_post falhou: %', SQLERRM;
  END;

  RETURN NEW;
END;
$function$;