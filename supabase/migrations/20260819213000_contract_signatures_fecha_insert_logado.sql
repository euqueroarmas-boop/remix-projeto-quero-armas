-- ============================================================================
-- RESÍDUO do item 7 (assinaturas do fluxo antigo) — 2026-08-19
-- A conferência mostrou uma policy que só existia no banco: qualquer usuário
-- LOGADO ainda podia inserir assinatura em contract_signatures. Fecha aqui.
-- Só edge functions (service_role) gravam nessa tabela — nada quebra.
-- Seguro para colar mais de uma vez.
-- ============================================================================
DROP POLICY IF EXISTS "Authenticated can insert contract_signatures" ON public.contract_signatures;

