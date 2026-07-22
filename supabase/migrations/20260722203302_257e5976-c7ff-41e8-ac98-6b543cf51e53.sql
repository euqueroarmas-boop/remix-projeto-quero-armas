CREATE OR REPLACE FUNCTION public.qa_dispatch_documento_em_dia()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url text;
  v_service text;
  v_cliente_id integer;
  v_documento text;
  v_numero text;
  v_validade date;
  v_ref_tabela text := TG_TABLE_NAME;
  v_ref_id text;
  v_evento text := 'cadastrado';
  v_old_validade date;
BEGIN
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

  IF TG_TABLE_NAME = 'qa_cadastro_cr' THEN
    v_cliente_id := NEW.cliente_id;
    v_documento  := 'CR';
    v_numero     := COALESCE(NEW.numero_cr, '');
    v_validade   := NEW.validade_cr;
    v_ref_id     := NEW.id::text;
    IF TG_OP = 'UPDATE' THEN v_old_validade := OLD.validade_cr; END IF;
  ELSIF TG_TABLE_NAME = 'qa_crafs' THEN
    v_cliente_id := NEW.cliente_id;
    v_documento  := COALESCE(NEW.nome_craf, 'CRAF');
    v_numero     := COALESCE(NEW.numero_sigma, NEW.numero_arma, '');
    v_validade   := NEW.data_validade;
    v_ref_id     := NEW.id::text;
    IF TG_OP = 'UPDATE' THEN v_old_validade := OLD.data_validade; END IF;
  ELSIF TG_TABLE_NAME = 'qa_documentos_cliente' THEN
    IF NEW.data_validade IS NULL THEN RETURN NEW; END IF;
    IF lower(NEW.tipo_documento) SIMILAR TO '%(gte|exame|laudo)%' THEN RETURN NEW; END IF;
    v_cliente_id := NEW.qa_cliente_id;
    v_documento  := NEW.tipo_documento;
    v_numero     := COALESCE(NEW.numero_documento, '');
    v_validade   := NEW.data_validade;
    v_ref_id     := NEW.id::text;
    IF TG_OP = 'UPDATE' THEN v_old_validade := OLD.data_validade; END IF;
  ELSE
    RETURN NEW;
  END IF;

  IF v_cliente_id IS NULL OR v_validade IS NULL THEN RETURN NEW; END IF;

  IF TG_OP = 'UPDATE' THEN
    IF v_old_validade IS NOT DISTINCT FROM v_validade THEN RETURN NEW; END IF;
    IF v_old_validade IS NOT NULL AND v_validade <= v_old_validade THEN RETURN NEW; END IF;
    v_evento := 'renovado';
  END IF;

  PERFORM net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(v_service, '')
    ),
    body := jsonb_build_object(
      'evento', 'documento_em_dia',
      'cliente_id', v_cliente_id,
      'documento', v_documento,
      'numero', v_numero,
      'validade', to_char(v_validade, 'YYYY-MM-DD'),
      'documento_evento', v_evento,
      'referencia_tabela', v_ref_tabela,
      'referencia_id', v_ref_id
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_qa_cr_verde ON public.qa_cadastro_cr;
CREATE TRIGGER trg_qa_cr_verde
AFTER INSERT OR UPDATE OF validade_cr ON public.qa_cadastro_cr
FOR EACH ROW EXECUTE FUNCTION public.qa_dispatch_documento_em_dia();

DROP TRIGGER IF EXISTS trg_qa_craf_verde ON public.qa_crafs;
CREATE TRIGGER trg_qa_craf_verde
AFTER INSERT OR UPDATE OF data_validade ON public.qa_crafs
FOR EACH ROW EXECUTE FUNCTION public.qa_dispatch_documento_em_dia();

DROP TRIGGER IF EXISTS trg_qa_doc_cliente_verde ON public.qa_documentos_cliente;
CREATE TRIGGER trg_qa_doc_cliente_verde
AFTER INSERT OR UPDATE OF data_validade ON public.qa_documentos_cliente
FOR EACH ROW EXECUTE FUNCTION public.qa_dispatch_documento_em_dia();