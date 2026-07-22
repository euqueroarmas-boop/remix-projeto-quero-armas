CREATE OR REPLACE FUNCTION public.qa_dispatch_exigencia_cumprida()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url text;
  v_service text;
  v_processo_nome text;
BEGIN
  IF NEW.status <> 'aprovado' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'aprovado' THEN RETURN NEW; END IF;
  IF NEW.cliente_id IS NULL THEN RETURN NEW; END IF;

  BEGIN
    SELECT decrypted_secret INTO v_url
      FROM vault.decrypted_secrets WHERE name = 'edge_qa_notify_event_url' LIMIT 1;
  EXCEPTION WHEN OTHERS THEN v_url := NULL; END;
  IF v_url IS NULL THEN
    BEGIN
      SELECT decrypted_secret INTO v_url
        FROM vault.decrypted_secrets WHERE name = 'edge_base_url' LIMIT 1;
      IF v_url IS NOT NULL THEN v_url := v_url || '/qa-notify-event'; END IF;
    EXCEPTION WHEN OTHERS THEN v_url := NULL; END;
  END IF;
  IF v_url IS NULL THEN RETURN NEW; END IF;

  BEGIN
    SELECT decrypted_secret INTO v_service
      FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1;
  EXCEPTION WHEN OTHERS THEN v_service := NULL; END;

  SELECT servico_nome INTO v_processo_nome
    FROM public.qa_processos WHERE id = NEW.processo_id;

  PERFORM net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(v_service, '')
    ),
    body := jsonb_build_object(
      'evento', 'exigencia_cumprida',
      'cliente_id', NEW.cliente_id,
      'processo', COALESCE(v_processo_nome, 'Processo'),
      'exigencia', COALESCE(NEW.nome_documento, NEW.tipo_documento),
      'referencia_tabela', 'qa_processo_documentos',
      'referencia_id', NEW.id::text
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_qa_processo_doc_verde ON public.qa_processo_documentos;
CREATE TRIGGER trg_qa_processo_doc_verde
AFTER UPDATE OF status ON public.qa_processo_documentos
FOR EACH ROW EXECUTE FUNCTION public.qa_dispatch_exigencia_cumprida();