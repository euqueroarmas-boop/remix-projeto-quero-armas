
-- Ponte Hub Documental → status canônico de contrato / procuração
CREATE OR REPLACE FUNCTION public.qa_bridge_hub_to_canonical_signatures()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tipo text;
  v_cliente_id integer;
  v_path text;
BEGIN
  v_tipo := lower(coalesce(NEW.tipo_documento, ''));
  IF v_tipo NOT IN ('contrato_assinado', 'procuracao_assinada') THEN
    RETURN NEW;
  END IF;
  IF coalesce(NEW.status, '') <> 'aprovado' THEN
    RETURN NEW;
  END IF;
  -- Só age em transição para aprovado (evita loops)
  IF TG_OP = 'UPDATE' AND coalesce(OLD.status, '') = 'aprovado' THEN
    RETURN NEW;
  END IF;

  v_cliente_id := NEW.qa_cliente_id;
  v_path := NEW.arquivo_storage_path;
  IF v_cliente_id IS NULL THEN RETURN NEW; END IF;

  IF v_tipo = 'contrato_assinado' THEN
    UPDATE public.qa_contracts
       SET status = 'validated',
           validation_status = 'valid',
           customer_signed_pdf_path = COALESCE(customer_signed_pdf_path, v_path),
           customer_uploaded_at = COALESCE(customer_uploaded_at, now()),
           customer_signature_validated_at = COALESCE(customer_signature_validated_at, now()),
           updated_at = now()
     WHERE cliente_id = v_cliente_id
       AND status IN (
         'generated_pending_company_signature',
         'pending_customer_signature',
         'customer_signature_uploaded',
         'validating',
         'rejected',
         'pending_manual_review'
       );
  ELSIF v_tipo = 'procuracao_assinada' THEN
    UPDATE public.qa_procuracoes
       SET status = 'validated',
           arquivo_assinado_path = COALESCE(arquivo_assinado_path, v_path),
           customer_signature_uploaded_at = COALESCE(customer_signature_uploaded_at, now()),
           validated_at = COALESCE(validated_at, now()),
           updated_at = now()
     WHERE cliente_id = v_cliente_id
       AND status IN (
         'generated_pending_customer_signature',
         'customer_signature_uploaded',
         'rejected'
       );
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_qa_bridge_hub_to_canonical_signatures ON public.qa_documentos_cliente;
CREATE TRIGGER trg_qa_bridge_hub_to_canonical_signatures
AFTER INSERT OR UPDATE OF status ON public.qa_documentos_cliente
FOR EACH ROW EXECUTE FUNCTION public.qa_bridge_hub_to_canonical_signatures();

-- Backfill: cliente 211 (piloto real)
UPDATE public.qa_contracts c
   SET status = 'validated',
       validation_status = 'valid',
       customer_signed_pdf_path = COALESCE(c.customer_signed_pdf_path, d.arquivo_storage_path),
       customer_uploaded_at = COALESCE(c.customer_uploaded_at, now()),
       customer_signature_validated_at = COALESCE(c.customer_signature_validated_at, now()),
       updated_at = now()
  FROM public.qa_documentos_cliente d
 WHERE c.cliente_id = 211
   AND d.qa_cliente_id = 211
   AND d.tipo_documento = 'contrato_assinado'
   AND d.status = 'aprovado'
   AND c.status <> 'validated';

UPDATE public.qa_procuracoes p
   SET status = 'validated',
       arquivo_assinado_path = COALESCE(p.arquivo_assinado_path, d.arquivo_storage_path),
       customer_signature_uploaded_at = COALESCE(p.customer_signature_uploaded_at, now()),
       validated_at = COALESCE(p.validated_at, now()),
       updated_at = now()
  FROM public.qa_documentos_cliente d
 WHERE p.cliente_id = 211
   AND d.qa_cliente_id = 211
   AND d.tipo_documento = 'procuracao_assinada'
   AND d.status = 'aprovado'
   AND p.status NOT IN ('validated', 'reaproveitada');
