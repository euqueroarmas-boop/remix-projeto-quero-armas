-- Allow authenticated users to INSERT and SELECT on budget_leads, quotes, customers, contracts, leads, logs_sistema
-- The current policies only allow 'anon' but authenticated users also need access

CREATE POLICY "Authenticated can insert budget_leads"
  ON public.budget_leads FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated can read budget_leads"
  ON public.budget_leads FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated can insert quotes"
  ON public.quotes FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated can read quotes"
  ON public.quotes FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated can insert leads"
  ON public.leads FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated can insert logs_sistema"
  ON public.logs_sistema FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated can insert customers"
  ON public.customers FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated can insert contracts"
  ON public.contracts FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated can read contracts"
  ON public.contracts FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated can update contracts"
  ON public.contracts FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated can insert payments"
  ON public.payments FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated can insert contract_signatures"
  ON public.contract_signatures FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated can insert contract_equipment"
  ON public.contract_equipment FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated can read contract_equipment"
  ON public.contract_equipment FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated can insert network_diagnostics"
  ON public.network_diagnostics FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated can read network_diagnostics"
  ON public.network_diagnostics FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated can insert proposals"
  ON public.proposals FOR INSERT TO authenticated
  WITH CHECK (true);