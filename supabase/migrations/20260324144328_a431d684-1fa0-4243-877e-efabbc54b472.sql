
-- Remove anon SELECT from admin-only tables
DROP POLICY IF EXISTS "Anyone can read admin_audit_logs" ON public.admin_audit_logs;
DROP POLICY IF EXISTS "Anyone can insert admin_audit_logs" ON public.admin_audit_logs;
DROP POLICY IF EXISTS "Anyone can read security_events" ON public.security_events;
DROP POLICY IF EXISTS "Anyone can insert security_events" ON public.security_events;
DROP POLICY IF EXISTS "Anyone can read integration_logs" ON public.integration_logs;
DROP POLICY IF EXISTS "Anyone can insert integration_logs" ON public.integration_logs;
DROP POLICY IF EXISTS "Anyone can read logs" ON public.logs_sistema;
DROP POLICY IF EXISTS "Service role full access webhooks" ON public.asaas_webhooks;

-- Keep anon INSERT on logs_sistema (used by client-side logSistema)
CREATE POLICY "Anon can insert logs" ON public.logs_sistema FOR INSERT TO anon WITH CHECK (true);

-- Remove anon SELECT from contract_signatures and budget_leads
DROP POLICY IF EXISTS "Anyone can read signatures" ON public.contract_signatures;
DROP POLICY IF EXISTS "Anyone can read budget leads" ON public.budget_leads;
