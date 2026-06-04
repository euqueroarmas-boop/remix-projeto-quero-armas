-- =====================================================================
-- FASE 2C-5: trigger pós-pagamento agora chama qa-provisionar-acesso-portal
-- (QA puro). Substitui chamada anterior a create-client-user (WMTi).
-- =====================================================================

CREATE OR REPLACE FUNCTION public.qa_vendas_provisionar_portal_on_pago()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cliente record;
  v_request_id bigint;
  v_function_url text;
  v_anon_key text;
BEGIN
  -- Apenas transição PARA 'PAGO'
  IF NEW.status IS DISTINCT FROM 'PAGO' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status = 'PAGO' THEN
    RETURN NEW;
  END IF;

  IF NEW.cliente_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT id, nome_completo, email, cpf, portal_provisionado_em, status
    INTO v_cliente
    FROM public.qa_clientes
   WHERE id = NEW.cliente_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- LGPD: cliente excluído logicamente => não provisionar
  IF v_cliente.status = 'excluido_lgpd' THEN
    RETURN NEW;
  END IF;

  -- Já provisionado => idempotente, não dispara de novo
  IF v_cliente.portal_provisionado_em IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Sem e-mail => audita e sai
  IF v_cliente.email IS NULL OR length(trim(v_cliente.email)) = 0 THEN
    BEGIN
      INSERT INTO public.qa_processo_eventos (processo_id, tipo_evento, descricao, ator)
      SELECT p.id, 'falha_envio_email',
             'Auto-provisionamento de Portal pulado: cliente sem e-mail cadastrado.',
             'sistema'
        FROM public.qa_processos p
       WHERE p.cliente_id = v_cliente.id
       LIMIT 1;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
    RETURN NEW;
  END IF;

  v_function_url := 'https://ogkltfqvzweeqkfmrzts.supabase.co/functions/v1/qa-provisionar-acesso-portal';
  v_anon_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9na2x0ZnF2endlZXFrZm1yenRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4ODc4OTIsImV4cCI6MjA5MjQ2Mzg5Mn0.Bqn76pQvh5f0lfDoucMB8BAo9y3Fs4vnVslbwGg73-g';

  BEGIN
    SELECT net.http_post(
      url := v_function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_anon_key,
        'apikey', v_anon_key,
        'x-trigger-source', 'qa_vendas_pago_acesso'
      ),
      body := jsonb_build_object(
        'qa_client_id', v_cliente.id,
        'venda_id', NEW.id,
        'origem_trigger', 'qa_vendas_status_pago'
      )
    ) INTO v_request_id;

    BEGIN
      INSERT INTO public.qa_processo_eventos (processo_id, tipo_evento, descricao, ator)
      SELECT p.id, 'portal_provisionamento_disparado',
             format('Auto-provisionamento de Portal QA disparado (venda #%s, request_id=%s).', NEW.id, v_request_id),
             'sistema'
        FROM public.qa_processos p
       WHERE p.cliente_id = v_cliente.id
       LIMIT 1;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  EXCEPTION WHEN OTHERS THEN
    BEGIN
      INSERT INTO public.qa_processo_eventos (processo_id, tipo_evento, descricao, ator)
      SELECT p.id, 'falha_envio_email',
             format('Falha ao disparar qa-provisionar-acesso-portal via pg_net: %s', SQLERRM),
             'sistema'
        FROM public.qa_processos p
       WHERE p.cliente_id = v_cliente.id
       LIMIT 1;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END;

  RETURN NEW;
END;
$$;
