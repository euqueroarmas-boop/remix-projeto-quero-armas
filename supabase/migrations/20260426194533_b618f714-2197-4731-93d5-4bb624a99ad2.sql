-- ============================================
-- ONDA 1: Hardening de PII crítica
-- ============================================

-- 1. CUSTOMERS: revogar SELECT/UPDATE anônimo
DROP POLICY IF EXISTS "Anyone can read customers" ON public.customers;
-- Mantém: "Anyone can insert customer" (necessário para checkout anon)
-- Mantém: "Authenticated users read own customer" (user_id = auth.uid())
-- Mantém: "Service role full access customers"

-- 2. CONTRACTS: revogar SELECT/UPDATE anônimo
DROP POLICY IF EXISTS "Anyone can read contracts" ON public.contracts;
DROP POLICY IF EXISTS "Anyone can update contracts" ON public.contracts;
DROP POLICY IF EXISTS "Authenticated can read contracts" ON public.contracts;
DROP POLICY IF EXISTS "Authenticated can update contracts" ON public.contracts;
-- Mantém: "Anyone can insert contract" (checkout anon)
-- Mantém: "Auth users read own contracts" (via customer/user_id)
-- Mantém: "Service role full access contracts"

-- 3. PAYMENTS: revogar SELECT anônimo
DROP POLICY IF EXISTS "Anyone can read payments" ON public.payments;
-- Mantém: "Anyone can insert payment" (checkout anon)
-- Mantém: "Auth users read own payments"
-- Mantém: "Service role full access payments"

-- 4. QA_TERCEIROS: bloquear acesso anônimo total
DROP POLICY IF EXISTS "Anon full access qa_terceiros" ON public.qa_terceiros;
DROP POLICY IF EXISTS "Auth full access qa_terceiros" ON public.qa_terceiros;

-- Recriar com controle de staff QA (mesmo padrão de qa_clientes)
CREATE POLICY "qa_terceiros_staff_select"
  ON public.qa_terceiros FOR SELECT
  TO authenticated
  USING (public.qa_is_active_staff(auth.uid()));

CREATE POLICY "qa_terceiros_staff_insert"
  ON public.qa_terceiros FOR INSERT
  TO authenticated
  WITH CHECK (public.qa_is_active_staff(auth.uid()));

CREATE POLICY "qa_terceiros_staff_update"
  ON public.qa_terceiros FOR UPDATE
  TO authenticated
  USING (public.qa_is_active_staff(auth.uid()))
  WITH CHECK (public.qa_is_active_staff(auth.uid()));

CREATE POLICY "qa_terceiros_admin_delete"
  ON public.qa_terceiros FOR DELETE
  TO authenticated
  USING (public.qa_has_qa_perfil(auth.uid(), ARRAY['administrador'::text]));

CREATE POLICY "qa_terceiros_service_role"
  ON public.qa_terceiros FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);