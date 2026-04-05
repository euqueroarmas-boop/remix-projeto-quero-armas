
-- 1. FISCAL EVENT HISTORY (append-only, immutable audit trail)
CREATE TABLE public.fiscal_event_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fiscal_document_id uuid REFERENCES public.fiscal_documents(id) ON DELETE SET NULL,
  asaas_invoice_id text,
  customer_id uuid,
  event_type text NOT NULL,
  event_source text NOT NULL DEFAULT 'unknown',
  event_timestamp timestamptz NOT NULL DEFAULT now(),
  received_at timestamptz NOT NULL DEFAULT now(),
  payload_snapshot jsonb DEFAULT '{}'::jsonb,
  normalized_status text,
  overwrite_decision text DEFAULT 'accepted',
  decision_reason text,
  created_by_process text DEFAULT 'unknown',
  correlation_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.fiscal_event_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access fiscal_event_history"
  ON public.fiscal_event_history FOR ALL
  TO service_role USING (true) WITH CHECK (true);

CREATE INDEX idx_feh_fiscal_doc ON public.fiscal_event_history(fiscal_document_id);
CREATE INDEX idx_feh_asaas_invoice ON public.fiscal_event_history(asaas_invoice_id);
CREATE INDEX idx_feh_customer ON public.fiscal_event_history(customer_id);
CREATE INDEX idx_feh_event_type ON public.fiscal_event_history(event_type);
CREATE INDEX idx_feh_created_at ON public.fiscal_event_history(created_at);

-- 2. FISCAL CHANGE LOG (sensitive field changes)
CREATE TABLE public.fiscal_change_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fiscal_document_id uuid NOT NULL REFERENCES public.fiscal_documents(id) ON DELETE SET NULL,
  field_name text NOT NULL,
  old_value text,
  new_value text,
  change_source text NOT NULL DEFAULT 'unknown',
  changed_at timestamptz NOT NULL DEFAULT now(),
  changed_by_process text DEFAULT 'unknown',
  related_event_history_id uuid REFERENCES public.fiscal_event_history(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.fiscal_change_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access fiscal_change_log"
  ON public.fiscal_change_log FOR ALL
  TO service_role USING (true) WITH CHECK (true);

CREATE INDEX idx_fcl_fiscal_doc ON public.fiscal_change_log(fiscal_document_id);
CREATE INDEX idx_fcl_field ON public.fiscal_change_log(field_name);
CREATE INDEX idx_fcl_changed_at ON public.fiscal_change_log(changed_at);

-- 3. DELETE PROTECTION TRIGGERS
-- Block deletes on fiscal_documents (except service_role via direct SQL)
CREATE OR REPLACE FUNCTION public.protect_fiscal_documents_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Log the attempt
  INSERT INTO public.integration_logs (integration_name, operation_name, request_payload, status, error_message)
  VALUES ('fiscal_audit', 'delete_blocked', jsonb_build_object('table', TG_TABLE_NAME, 'id', OLD.id, 'asaas_invoice_id', OLD.asaas_invoice_id), 'error', 'DELETE blocked by audit protection trigger');
  
  RAISE EXCEPTION 'DELETE em documentos fiscais é proibido. Use is_active = false para inativar.';
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_protect_fiscal_documents_delete
  BEFORE DELETE ON public.fiscal_documents
  FOR EACH ROW EXECUTE FUNCTION public.protect_fiscal_documents_delete();

-- Block deletes on fiscal_event_history
CREATE OR REPLACE FUNCTION public.protect_fiscal_event_history_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'DELETE em histórico fiscal é proibido. Registros de auditoria são imutáveis.';
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_protect_fiscal_event_history_delete
  BEFORE DELETE ON public.fiscal_event_history
  FOR EACH ROW EXECUTE FUNCTION public.protect_fiscal_event_history_delete();

-- Block deletes on fiscal_change_log
CREATE TRIGGER trg_protect_fiscal_change_log_delete
  BEFORE DELETE ON public.fiscal_change_log
  FOR EACH ROW EXECUTE FUNCTION public.protect_fiscal_event_history_delete();
