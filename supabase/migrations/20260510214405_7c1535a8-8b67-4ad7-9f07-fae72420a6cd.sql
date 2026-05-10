
-- ============================================================
-- BLOCO 10 — qa_contracts family (pós-pagamento Quero Armas)
-- ============================================================

-- 1) qa_contracts ------------------------------------------------
CREATE TABLE IF NOT EXISTS public.qa_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venda_id integer NOT NULL UNIQUE,
  cliente_id integer NOT NULL,
  contract_number text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'generated_pending_company_signature',
  signature_mode_company text,
  original_pdf_path text,
  company_signed_pdf_path text,
  customer_signed_pdf_path text,
  original_sha256 text,
  company_signed_sha256 text,
  customer_signed_sha256 text,
  issued_at timestamptz,
  company_signed_at timestamptz,
  customer_uploaded_at timestamptz,
  customer_signature_validated_at timestamptz,
  validation_status text,
  validation_details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_qa_contracts_status CHECK (status IN (
    'generated_pending_company_signature',
    'pending_customer_signature',
    'customer_signature_uploaded',
    'validating',
    'validated',
    'rejected',
    'pending_manual_review'
  )),
  CONSTRAINT chk_qa_contracts_validation CHECK (
    validation_status IS NULL OR validation_status IN ('valid','invalid','indeterminate','pending_manual_review')
  ),
  CONSTRAINT chk_qa_contracts_sigmode CHECK (
    signature_mode_company IS NULL OR signature_mode_company IN ('representative_govbr','representative_icp','company_icp')
  ),
  CONSTRAINT fk_qa_contracts_venda FOREIGN KEY (venda_id) REFERENCES public.qa_vendas(id_legado) ON DELETE RESTRICT,
  CONSTRAINT fk_qa_contracts_cliente FOREIGN KEY (cliente_id) REFERENCES public.qa_clientes(id_legado) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_qa_contracts_cliente ON public.qa_contracts(cliente_id);
CREATE INDEX IF NOT EXISTS idx_qa_contracts_status ON public.qa_contracts(status);
CREATE INDEX IF NOT EXISTS idx_qa_contracts_validation_status ON public.qa_contracts(validation_status);

-- 2) qa_contract_items (SNAPSHOT IMUTÁVEL) ----------------------
CREATE TABLE IF NOT EXISTS public.qa_contract_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.qa_contracts(id) ON DELETE CASCADE,
  venda_id integer NOT NULL,
  item_venda_id integer,
  service_id_snapshot integer,
  service_slug_snapshot text,
  service_name_snapshot text NOT NULL,
  service_description_snapshot text,
  quantity integer NOT NULL DEFAULT 1,
  unit_price_cents integer NOT NULL DEFAULT 0,
  total_price_cents integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qa_contract_items_contract ON public.qa_contract_items(contract_id);

-- proteção contra mutação do snapshot
CREATE OR REPLACE FUNCTION public.qa_contract_items_block_update()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'qa_contract_items é imutável (snapshot)';
END $$;

DROP TRIGGER IF EXISTS trg_qa_contract_items_no_update ON public.qa_contract_items;
CREATE TRIGGER trg_qa_contract_items_no_update
BEFORE UPDATE ON public.qa_contract_items
FOR EACH ROW EXECUTE FUNCTION public.qa_contract_items_block_update();

-- 3) qa_contract_signatures -------------------------------------
CREATE TABLE IF NOT EXISTS public.qa_contract_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.qa_contracts(id) ON DELETE CASCADE,
  signer_role text NOT NULL,
  signer_name text,
  signer_document text,
  signature_type text,
  validation_status text,
  validation_details jsonb NOT NULL DEFAULT '{}'::jsonb,
  signed_pdf_path text,
  signed_pdf_sha256 text,
  signed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_qa_contract_sig_role CHECK (signer_role IN ('company','customer')),
  CONSTRAINT chk_qa_contract_sig_type CHECK (
    signature_type IS NULL OR signature_type IN ('representative_govbr','representative_icp','company_icp','customer_govbr','customer_icp')
  ),
  CONSTRAINT chk_qa_contract_sig_validation CHECK (
    validation_status IS NULL OR validation_status IN ('valid','invalid','indeterminate','pending_manual_review','not_required')
  )
);

CREATE INDEX IF NOT EXISTS idx_qa_contract_signatures_contract ON public.qa_contract_signatures(contract_id);

-- 4) qa_contract_events -----------------------------------------
CREATE TABLE IF NOT EXISTS public.qa_contract_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.qa_contracts(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  event_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qa_contract_events_contract ON public.qa_contract_events(contract_id, created_at DESC);

-- updated_at trigger ---------------------------------------------
CREATE OR REPLACE FUNCTION public.qa_contracts_set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_qa_contracts_updated_at ON public.qa_contracts;
CREATE TRIGGER trg_qa_contracts_updated_at
BEFORE UPDATE ON public.qa_contracts
FOR EACH ROW EXECUTE FUNCTION public.qa_contracts_set_updated_at();

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE public.qa_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qa_contract_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qa_contract_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qa_contract_events ENABLE ROW LEVEL SECURITY;

-- qa_contracts policies
CREATE POLICY "qa_contracts_staff_all" ON public.qa_contracts
  FOR ALL TO authenticated
  USING (public.qa_is_active_staff(auth.uid()))
  WITH CHECK (public.qa_is_active_staff(auth.uid()));

CREATE POLICY "qa_contracts_owner_select" ON public.qa_contracts
  FOR SELECT TO authenticated
  USING (cliente_id = public.qa_current_cliente_id(auth.uid()));

-- qa_contract_items policies
CREATE POLICY "qa_contract_items_staff_all" ON public.qa_contract_items
  FOR ALL TO authenticated
  USING (public.qa_is_active_staff(auth.uid()))
  WITH CHECK (public.qa_is_active_staff(auth.uid()));

CREATE POLICY "qa_contract_items_owner_select" ON public.qa_contract_items
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.qa_contracts c
    WHERE c.id = qa_contract_items.contract_id
      AND c.cliente_id = public.qa_current_cliente_id(auth.uid())
  ));

-- qa_contract_signatures policies
CREATE POLICY "qa_contract_signatures_staff_all" ON public.qa_contract_signatures
  FOR ALL TO authenticated
  USING (public.qa_is_active_staff(auth.uid()))
  WITH CHECK (public.qa_is_active_staff(auth.uid()));

CREATE POLICY "qa_contract_signatures_owner_select" ON public.qa_contract_signatures
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.qa_contracts c
    WHERE c.id = qa_contract_signatures.contract_id
      AND c.cliente_id = public.qa_current_cliente_id(auth.uid())
  ));

-- qa_contract_events policies (somente staff lê e escreve)
CREATE POLICY "qa_contract_events_staff_all" ON public.qa_contract_events
  FOR ALL TO authenticated
  USING (public.qa_is_active_staff(auth.uid()))
  WITH CHECK (public.qa_is_active_staff(auth.uid()));
