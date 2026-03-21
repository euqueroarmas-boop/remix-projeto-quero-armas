
-- Service requests / chamados
CREATE TABLE public.service_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE NOT NULL,
  quote_id uuid REFERENCES public.quotes(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  service_type text NOT NULL DEFAULT 'suporte',
  status text NOT NULL DEFAULT 'recebido',
  priority text NOT NULL DEFAULT 'normal',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.service_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert service_requests" ON public.service_requests FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anyone can read service_requests" ON public.service_requests FOR SELECT TO anon USING (true);
CREATE POLICY "Anyone can update service_requests" ON public.service_requests FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access service_requests" ON public.service_requests FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Client events / timeline
CREATE TABLE public.client_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE NOT NULL,
  event_type text NOT NULL,
  title text NOT NULL,
  description text,
  related_id uuid,
  related_table text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.client_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert client_events" ON public.client_events FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anyone can read client_events" ON public.client_events FOR SELECT TO anon USING (true);
CREATE POLICY "Service role full access client_events" ON public.client_events FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Fiscal documents
CREATE TABLE public.fiscal_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE NOT NULL,
  payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL,
  contract_id uuid REFERENCES public.contracts(id) ON DELETE SET NULL,
  document_type text NOT NULL DEFAULT 'nota_fiscal',
  document_number text,
  issue_date date NOT NULL DEFAULT CURRENT_DATE,
  amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'emitido',
  file_url text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.fiscal_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read fiscal_documents" ON public.fiscal_documents FOR SELECT TO anon USING (true);
CREATE POLICY "Anyone can insert fiscal_documents" ON public.fiscal_documents FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Service role full access fiscal_documents" ON public.fiscal_documents FOR ALL TO service_role USING (true) WITH CHECK (true);
