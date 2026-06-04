-- ============================================
-- ONDA 3: Hardening operacional e configuração
-- ============================================

-- Helper: garantir policy de admin para leitura/atualização nas tabelas operacionais
-- (usa has_role já existente no schema)

-- ===== 1. PROPOSALS =====
DROP POLICY IF EXISTS "Anyone can read proposals" ON public.proposals;
CREATE POLICY "Admins can read proposals" ON public.proposals
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::lp_app_role));

-- ===== 2. SERVICE_REQUESTS =====
DROP POLICY IF EXISTS "Anyone can read service_requests" ON public.service_requests;
DROP POLICY IF EXISTS "Anyone can update service_requests" ON public.service_requests;
CREATE POLICY "Admins can read service_requests" ON public.service_requests
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::lp_app_role));
CREATE POLICY "Admins can update service_requests" ON public.service_requests
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::lp_app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::lp_app_role));

-- ===== 3. BUDGET_LEADS =====
DROP POLICY IF EXISTS "Anon can read budget_leads" ON public.budget_leads;
CREATE POLICY "Admins can read budget_leads" ON public.budget_leads
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::lp_app_role));

-- ===== 4. CLIENT_EVENTS =====
DROP POLICY IF EXISTS "Anyone can read client_events" ON public.client_events;
CREATE POLICY "Admins can read client_events" ON public.client_events
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::lp_app_role));

-- ===== 5. NETWORK_DIAGNOSTICS =====
DROP POLICY IF EXISTS "Anyone can read diagnostics" ON public.network_diagnostics;
CREATE POLICY "Admins can read diagnostics" ON public.network_diagnostics
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::lp_app_role));

-- ===== 6. FISCAL_DOCUMENTS =====
DROP POLICY IF EXISTS "Anyone can read fiscal_documents" ON public.fiscal_documents;
CREATE POLICY "Admins can read fiscal_documents" ON public.fiscal_documents
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::lp_app_role));

-- ===== 7. CONTRACT_EQUIPMENT =====
DROP POLICY IF EXISTS "Anyone can read equipment" ON public.contract_equipment;
CREATE POLICY "Admins can read equipment" ON public.contract_equipment
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::lp_app_role));

-- ===== 8. CONTRACT_SIGNATURES (apenas INSERT anon era exposto, mas vamos garantir SELECT staff) =====
-- (já não tinha SELECT anon, só formalizamos admin SELECT se ainda não existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'contract_signatures' AND cmd = 'SELECT'
  ) THEN
    CREATE POLICY "Admins can read contract_signatures" ON public.contract_signatures
      FOR SELECT TO authenticated
      USING (public.has_role(auth.uid(), 'admin'::lp_app_role));
  END IF;
END $$;

-- ===== 9. PROMPT_INTELLIGENCE — remover UPDATE público =====
DROP POLICY IF EXISTS "Public update prompt_intelligence" ON public.prompt_intelligence;
CREATE POLICY "Admins update prompt_intelligence" ON public.prompt_intelligence
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::lp_app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::lp_app_role));

-- ===== 10. REVENUE_INTELLIGENCE — remover UPDATE público =====
DROP POLICY IF EXISTS "Public update revenue_intelligence" ON public.revenue_intelligence;
CREATE POLICY "Admins update revenue_intelligence" ON public.revenue_intelligence
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::lp_app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::lp_app_role));

-- ===== 11. QA_DOCUMENT_JOBS — remover UPDATE público =====
DROP POLICY IF EXISTS "Anyone can update document jobs" ON public.qa_document_jobs;
CREATE POLICY "Staff can update document jobs" ON public.qa_document_jobs
  FOR UPDATE TO authenticated
  USING (public.qa_is_active_staff(auth.uid()))
  WITH CHECK (public.qa_is_active_staff(auth.uid()));

-- ===== 12. CATÁLOGOS QA — restringir edição =====
DROP POLICY IF EXISTS "Anon full access qa_servicos" ON public.qa_servicos;
CREATE POLICY "qa_servicos_public_select" ON public.qa_servicos
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "qa_servicos_staff_write" ON public.qa_servicos
  FOR INSERT TO authenticated WITH CHECK (public.qa_is_active_staff(auth.uid()));
CREATE POLICY "qa_servicos_staff_update" ON public.qa_servicos
  FOR UPDATE TO authenticated
  USING (public.qa_is_active_staff(auth.uid()))
  WITH CHECK (public.qa_is_active_staff(auth.uid()));
CREATE POLICY "qa_servicos_admin_delete" ON public.qa_servicos
  FOR DELETE TO authenticated
  USING (public.qa_has_qa_perfil(auth.uid(), ARRAY['administrador'::text]));

DROP POLICY IF EXISTS "Anon full access qa_status_tipos" ON public.qa_status_tipos;
CREATE POLICY "qa_status_tipos_public_select" ON public.qa_status_tipos
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "qa_status_tipos_staff_write" ON public.qa_status_tipos
  FOR INSERT TO authenticated WITH CHECK (public.qa_is_active_staff(auth.uid()));
CREATE POLICY "qa_status_tipos_staff_update" ON public.qa_status_tipos
  FOR UPDATE TO authenticated
  USING (public.qa_is_active_staff(auth.uid()))
  WITH CHECK (public.qa_is_active_staff(auth.uid()));
CREATE POLICY "qa_status_tipos_admin_delete" ON public.qa_status_tipos
  FOR DELETE TO authenticated
  USING (public.qa_has_qa_perfil(auth.uid(), ARRAY['administrador'::text]));

DROP POLICY IF EXISTS "Anon full access qa_tempo_validade" ON public.qa_tempo_validade;
CREATE POLICY "qa_tempo_validade_public_select" ON public.qa_tempo_validade
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "qa_tempo_validade_staff_write" ON public.qa_tempo_validade
  FOR INSERT TO authenticated WITH CHECK (public.qa_is_active_staff(auth.uid()));
CREATE POLICY "qa_tempo_validade_staff_update" ON public.qa_tempo_validade
  FOR UPDATE TO authenticated
  USING (public.qa_is_active_staff(auth.uid()))
  WITH CHECK (public.qa_is_active_staff(auth.uid()));
CREATE POLICY "qa_tempo_validade_admin_delete" ON public.qa_tempo_validade
  FOR DELETE TO authenticated
  USING (public.qa_has_qa_perfil(auth.uid(), ARRAY['administrador'::text]));

-- ===== 13. TABELAS LEGADAS NÃO UTILIZADAS — bloquear acesso público total =====
DROP POLICY IF EXISTS "Public full access cipa_cycles" ON public.cipa_cycles;
DROP POLICY IF EXISTS "Public full access cipa_locations" ON public.cipa_locations;
DROP POLICY IF EXISTS "Public full access cipa_stress_daily_stats" ON public.cipa_stress_daily_stats;
DROP POLICY IF EXISTS "Public full access cipa_stress_logs" ON public.cipa_stress_logs;
DROP POLICY IF EXISTS "Public full access cipa_stress_monthly_stats" ON public.cipa_stress_monthly_stats;
DROP POLICY IF EXISTS "Public full access cipa_voice_daily_stats" ON public.cipa_voice_daily_stats;
DROP POLICY IF EXISTS "Public full access emotion_events" ON public.emotion_events;
DROP POLICY IF EXISTS "Public full access emotion_logs" ON public.emotion_logs;
DROP POLICY IF EXISTS "Public full access emotion_statistics" ON public.emotion_statistics;
DROP POLICY IF EXISTS "Public full access emotion_triggers" ON public.emotion_triggers;
DROP POLICY IF EXISTS "Public full access intervention_logs" ON public.intervention_logs;
DROP POLICY IF EXISTS "Public full access relationship_members" ON public.relationship_members;
DROP POLICY IF EXISTS "Public full access relationships" ON public.relationships;
DROP POLICY IF EXISTS "Public full access user_streaks" ON public.user_streaks;
DROP POLICY IF EXISTS "Public full access voice_emotion_logs" ON public.voice_emotion_logs;
DROP POLICY IF EXISTS "Public access test_run_events" ON public.test_run_events;

-- Garantir que as tabelas continuam com RLS habilitado (sem policies = bloqueado)
ALTER TABLE public.cipa_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cipa_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cipa_stress_daily_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cipa_stress_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cipa_stress_monthly_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cipa_voice_daily_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emotion_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emotion_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emotion_statistics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emotion_triggers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intervention_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.relationship_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_streaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_emotion_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_run_events ENABLE ROW LEVEL SECURITY;