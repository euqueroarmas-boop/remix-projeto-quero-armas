-- =====================================================================
-- ONDA 5b — Refinamento de policies CMS/blog/leads
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) budget_leads: bloquear leitura aberta de leads comerciais
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated can read budget_leads" ON public.budget_leads;

CREATE POLICY "Budget leads: only admin can read"
  ON public.budget_leads FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- INSERT anônimo permanece (formulário público de orçamento)

-- ---------------------------------------------------------------------
-- 2) network_diagnostics: bloquear leitura aberta de diagnósticos internos
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated can read network_diagnostics" ON public.network_diagnostics;

CREATE POLICY "Network diagnostics: only admin can read"
  ON public.network_diagnostics FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- INSERT anônimo permanece (captura de telemetria)

-- ---------------------------------------------------------------------
-- 3) contract_equipment: leitura restrita ao dono do contrato + admin
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated can read contract_equipment" ON public.contract_equipment;

CREATE POLICY "Contract equipment: owner or admin can read"
  ON public.contract_equipment FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1
      FROM public.contracts ct
      JOIN public.customers cu ON cu.id = ct.customer_id
      WHERE ct.id = contract_equipment.contract_id
        AND cu.user_id = auth.uid()
    )
  );

-- INSERT anônimo/auth permanece (etapa do checkout)

-- ---------------------------------------------------------------------
-- 4) prompt_intelligence: fechar leitura/inserção públicas
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Public read prompt_intelligence" ON public.prompt_intelligence;
DROP POLICY IF EXISTS "Public insert prompt_intelligence" ON public.prompt_intelligence;

CREATE POLICY "Prompt intelligence: admin can read"
  ON public.prompt_intelligence FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Prompt intelligence: admin can insert"
  ON public.prompt_intelligence FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ---------------------------------------------------------------------
-- 5) Comentários de auditoria
-- ---------------------------------------------------------------------
COMMENT ON POLICY "Budget leads: only admin can read" ON public.budget_leads IS
  'Onda 5b: leads comerciais visíveis apenas para admins; INSERT público mantido para o formulário.';
COMMENT ON POLICY "Contract equipment: owner or admin can read" ON public.contract_equipment IS
  'Onda 5b: cliente vê só os equipamentos do próprio contrato (via customers.user_id).';
COMMENT ON POLICY "Prompt intelligence: admin can read" ON public.prompt_intelligence IS
  'Onda 5b: dados de inteligência de prompt restritos a admins.';