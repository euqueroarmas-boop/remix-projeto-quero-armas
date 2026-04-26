-- =====================================================================
-- ONDA 5 — HARDENING RLS (Mínimo Viável)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Limpeza: remover 16 tabelas órfãs vazias (de outros projetos)
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS public.cipa_stress_daily_stats CASCADE;
DROP TABLE IF EXISTS public.cipa_stress_monthly_stats CASCADE;
DROP TABLE IF EXISTS public.cipa_stress_logs CASCADE;
DROP TABLE IF EXISTS public.cipa_voice_daily_stats CASCADE;
DROP TABLE IF EXISTS public.cipa_cycles CASCADE;
DROP TABLE IF EXISTS public.cipa_locations CASCADE;
DROP TABLE IF EXISTS public.emotion_events CASCADE;
DROP TABLE IF EXISTS public.emotion_logs CASCADE;
DROP TABLE IF EXISTS public.emotion_statistics CASCADE;
DROP TABLE IF EXISTS public.emotion_triggers CASCADE;
DROP TABLE IF EXISTS public.voice_emotion_logs CASCADE;
DROP TABLE IF EXISTS public.intervention_logs CASCADE;
DROP TABLE IF EXISTS public.relationship_members CASCADE;
DROP TABLE IF EXISTS public.relationships CASCADE;
DROP TABLE IF EXISTS public.user_streaks CASCADE;
DROP TABLE IF EXISTS public.test_run_events CASCADE;

-- asaas_webhooks: manter, mas garantir que só service_role acessa
-- (já tem RLS habilitado sem policies, o que naturalmente bloqueia tudo
--  exceto service_role — adicionamos comentário explicativo)
COMMENT ON TABLE public.asaas_webhooks IS
  'Onda 5: RLS sem policies por design — apenas service_role (edge functions) lê/escreve. Dados de webhooks Asaas.';

-- ---------------------------------------------------------------------
-- 2) customers — restringir leitura/edição ao dono + admin
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated can read customers" ON public.customers;
DROP POLICY IF EXISTS "Authenticated can update customers" ON public.customers;
DROP POLICY IF EXISTS "Authenticated can delete customers" ON public.customers;

CREATE POLICY "Customers: owner or admin can read"
  ON public.customers FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Customers: owner or admin can update"
  ON public.customers FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Customers: admin can delete"
  ON public.customers FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ---------------------------------------------------------------------
-- 3) contracts — restringir via customers.user_id
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated can read contracts" ON public.contracts;
DROP POLICY IF EXISTS "Authenticated can update contracts" ON public.contracts;
DROP POLICY IF EXISTS "Authenticated can delete contracts" ON public.contracts;

CREATE POLICY "Contracts: owner or admin can read"
  ON public.contracts FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = contracts.customer_id AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Contracts: admin can update"
  ON public.contracts FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Contracts: admin can delete"
  ON public.contracts FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ---------------------------------------------------------------------
-- 4) proposals — restringir via customers.user_id
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated can read proposals" ON public.proposals;
DROP POLICY IF EXISTS "Authenticated can update proposals" ON public.proposals;
DROP POLICY IF EXISTS "Authenticated can delete proposals" ON public.proposals;

CREATE POLICY "Proposals: owner or admin can read"
  ON public.proposals FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = proposals.customer_id AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Proposals: admin can update"
  ON public.proposals FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Proposals: admin can delete"
  ON public.proposals FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ---------------------------------------------------------------------
-- 5) payments — service-role-only (sem coluna owner direta)
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Anyone can insert payment" ON public.payments;
DROP POLICY IF EXISTS "Authenticated can insert payments" ON public.payments;
DROP POLICY IF EXISTS "Authenticated can read payments" ON public.payments;
DROP POLICY IF EXISTS "Authenticated can update payments" ON public.payments;
DROP POLICY IF EXISTS "Authenticated can delete payments" ON public.payments;

-- Mantém apenas a policy "Service role full access payments" já existente
-- (acesso anônimo/autenticado bloqueado — fluxo passa por edge functions)
COMMENT ON TABLE public.payments IS
  'Onda 5: acesso restrito a service_role. Inserts feitos via edge functions (asaas-*).';

-- ---------------------------------------------------------------------
-- 6) qa_cadastro_publico — remover policies abertas
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated can update qa_cadastro_publico" ON public.qa_cadastro_publico;
DROP POLICY IF EXISTS "Authenticated users can read qa_cadastro_publico" ON public.qa_cadastro_publico;

-- Recria apenas para staff QA
CREATE POLICY "qa_cadastro_publico: QA staff can read"
  ON public.qa_cadastro_publico FOR SELECT TO authenticated
  USING (public.qa_is_active_staff(auth.uid()));

CREATE POLICY "qa_cadastro_publico: QA staff can update"
  ON public.qa_cadastro_publico FOR UPDATE TO authenticated
  USING (public.qa_is_active_staff(auth.uid()))
  WITH CHECK (public.qa_is_active_staff(auth.uid()));

CREATE POLICY "qa_cadastro_publico: QA staff can delete"
  ON public.qa_cadastro_publico FOR DELETE TO authenticated
  USING (public.qa_is_active_staff(auth.uid()));

-- INSERT permanece aberto (formulário público de cadastro inicial)

-- ---------------------------------------------------------------------
-- 7) qa_document_jobs — remover SELECT/INSERT abertos
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Anyone can read document jobs" ON public.qa_document_jobs;
DROP POLICY IF EXISTS "Anyone can insert document jobs" ON public.qa_document_jobs;

CREATE POLICY "qa_document_jobs: QA staff can read"
  ON public.qa_document_jobs FOR SELECT TO authenticated
  USING (public.qa_is_active_staff(auth.uid()));

CREATE POLICY "qa_document_jobs: QA staff can insert"
  ON public.qa_document_jobs FOR INSERT TO authenticated
  WITH CHECK (public.qa_is_active_staff(auth.uid()));

-- ---------------------------------------------------------------------
-- Comentários de auditoria
-- ---------------------------------------------------------------------
COMMENT ON POLICY "Customers: owner or admin can read" ON public.customers IS
  'Onda 5: dono vê só os próprios; admins veem tudo via has_role.';
COMMENT ON POLICY "Contracts: owner or admin can read" ON public.contracts IS
  'Onda 5: leitura via JOIN em customers.user_id ou role admin.';