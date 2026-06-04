-- =====================================================================
-- Trigger automática: provisionar Portal do Cliente quando venda vira PAGO
-- =====================================================================

-- 1) Função de geração de senha temporária (usa gen_random_uuid nativo)
CREATE OR REPLACE FUNCTION public.qa_gen_temp_password()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  -- 14 chars aleatórios do uuid (sem hífen) + complexidade fixa A1!
  SELECT
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 11)) || 'A1!'
$$;

-- 2) Função da trigger
CREATE OR REPLACE FUNCTION public.qa_vendas_provisionar_portal_on_pago()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cliente record;
  v_temp_pwd text;
  v_request_id bigint;
  v_function_url text;
  v_anon_key text;
BEGIN
  -- Só processa transição "para PAGO"
  IF NEW.status IS DISTINCT FROM 'PAGO' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status = 'PAGO' THEN
    RETURN NEW;
  END IF;

  IF NEW.cliente_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT id, nome_completo, email, cpf, customer_id, portal_provisionado_em, status
    INTO v_cliente
    FROM public.qa_clientes
   WHERE id = NEW.cliente_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- LGPD: não reprovisionar excluído logicamente
  IF v_cliente.status = 'excluido_lgpd' THEN
    RETURN NEW;
  END IF;

  -- Já provisionado? não recria
  IF v_cliente.portal_provisionado_em IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Sem e-mail? audita e sai
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

  v_temp_pwd := public.qa_gen_temp_password();

  v_function_url := 'https://ogkltfqvzweeqkfmrzts.supabase.co/functions/v1/create-client-user';
  v_anon_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9na2x0ZnF2endlZXFrZm1yenRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4ODc4OTIsImV4cCI6MjA5MjQ2Mzg5Mn0.Bqn76pQvh5f0lfDoucMB8BAo9y3Fs4vnVslbwGg73-g';

  BEGIN
    SELECT net.http_post(
      url := v_function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_anon_key,
        'apikey', v_anon_key,
        'x-trigger-source', 'qa_vendas_pago'
      ),
      body := jsonb_build_object(
        'qa_client_id', v_cliente.id,
        'customer_id', v_cliente.customer_id,
        'email', v_cliente.email,
        'document', v_cliente.cpf,
        'user_password', v_temp_pwd,
        'name', v_cliente.nome_completo,
        'customer_data', jsonb_build_object(
          'email', v_cliente.email,
          'razao_social', v_cliente.nome_completo,
          'responsavel', v_cliente.nome_completo,
          'cnpj_ou_cpf', regexp_replace(COALESCE(v_cliente.cpf, ''), '\D', '', 'g'),
          'status_cliente', 'ativo'
        ),
        'origem_trigger', 'qa_vendas_status_pago',
        'venda_id', NEW.id
      )
    ) INTO v_request_id;

    BEGIN
      INSERT INTO public.qa_processo_eventos (processo_id, tipo_evento, descricao, ator)
      SELECT p.id, 'portal_provisionamento_disparado',
             format('Auto-provisionamento de Portal disparado (venda #%s, request_id=%s).', NEW.id, v_request_id),
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
             format('Falha ao disparar auto-provisionamento via pg_net: %s', SQLERRM),
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

-- 3) Trigger AFTER UPDATE OF status (e AFTER INSERT, caso já entre como PAGO)
DROP TRIGGER IF EXISTS qa_vendas_after_pago_provisionar_portal ON public.qa_vendas;

CREATE TRIGGER qa_vendas_after_pago_provisionar_portal
AFTER INSERT OR UPDATE OF status ON public.qa_vendas
FOR EACH ROW
EXECUTE FUNCTION public.qa_vendas_provisionar_portal_on_pago();