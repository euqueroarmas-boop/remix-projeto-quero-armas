-- =========================================================================
-- FASE 2C-4: contrato pós-pagamento + Arsenal sempre gratuito
-- =========================================================================

-- 1) Desativa triggers que tratavam Arsenal como premium pago
DROP TRIGGER IF EXISTS trg_qa_vendas_arsenal_upgrade ON public.qa_vendas;
DROP TRIGGER IF EXISTS trg_qa_vendas_arsenal_upgrade_insert ON public.qa_vendas;

-- 2) Substitui a função da trigger pós-PAGO para realmente gerar contrato
CREATE OR REPLACE FUNCTION public.qa_vendas_after_pago_invoke_contract()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_status text;
  v_new_status text;
  v_function_url text;
  v_anon_key text;
  v_cliente_status text;
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
        'venda_id', NEW.id,
        'trigger_source', 'qa_vendas_after_pago'
      )
    );
  EXCEPTION WHEN OTHERS THEN
    -- Não falha o UPDATE da venda; auditoria mínima fica no Postgres logs
    RAISE NOTICE 'qa_vendas_after_pago_invoke_contract: net.http_post falhou: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.qa_vendas_after_pago_invoke_contract() IS
  'FASE 2C-4: dispara qa-generate-contract via pg_net na transição PAGO. Não toca Arsenal (gratuito), não cria processo/checklist, não libera execução operacional.';