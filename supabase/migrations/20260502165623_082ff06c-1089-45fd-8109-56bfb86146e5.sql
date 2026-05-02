CREATE OR REPLACE FUNCTION public.qa_sync_cr_from_documento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_id integer;
BEGIN
  -- Só age para documentos do tipo CR aprovados, com cliente vinculado.
  IF NEW.tipo_documento IS DISTINCT FROM 'cr' THEN
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM 'aprovado' THEN
    RETURN NEW;
  END IF;
  IF NEW.qa_cliente_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Em UPDATE, evita reprocessar se nada relevante mudou.
  IF TG_OP = 'UPDATE'
     AND OLD.status = 'aprovado'
     AND OLD.tipo_documento = 'cr'
     AND COALESCE(OLD.numero_documento,'') = COALESCE(NEW.numero_documento,'')
     AND OLD.data_validade IS NOT DISTINCT FROM NEW.data_validade THEN
    RETURN NEW;
  END IF;

  -- Procura o CR canônico mais recente do cliente (não consolidado).
  SELECT id INTO v_existing_id
  FROM public.qa_cadastro_cr
  WHERE cliente_id = NEW.qa_cliente_id
    AND consolidado_em IS NULL
  ORDER BY id DESC
  LIMIT 1;

  IF v_existing_id IS NULL THEN
    INSERT INTO public.qa_cadastro_cr (cliente_id, numero_cr, validade_cr)
    VALUES (NEW.qa_cliente_id, NEW.numero_documento, NEW.data_validade);
  ELSE
    UPDATE public.qa_cadastro_cr
       SET numero_cr   = COALESCE(NEW.numero_documento, numero_cr),
           validade_cr = COALESCE(NEW.data_validade,   validade_cr)
     WHERE id = v_existing_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS qa_sync_cr_from_documento_ins ON public.qa_documentos_cliente;
DROP TRIGGER IF EXISTS qa_sync_cr_from_documento_upd ON public.qa_documentos_cliente;

CREATE TRIGGER qa_sync_cr_from_documento_ins
AFTER INSERT ON public.qa_documentos_cliente
FOR EACH ROW EXECUTE FUNCTION public.qa_sync_cr_from_documento();

CREATE TRIGGER qa_sync_cr_from_documento_upd
AFTER UPDATE ON public.qa_documentos_cliente
FOR EACH ROW EXECUTE FUNCTION public.qa_sync_cr_from_documento();