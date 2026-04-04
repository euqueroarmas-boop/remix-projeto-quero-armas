
-- Limpeza de dados de teste - respeita ordem de FK
-- Tabelas dependentes primeiro

-- Nível 3: dependem de contracts
TRUNCATE TABLE public.contract_signatures CASCADE;
TRUNCATE TABLE public.contract_equipment CASCADE;
TRUNCATE TABLE public.signature_logs CASCADE;

-- Nível 2: dependem de customers, contracts, quotes
TRUNCATE TABLE public.fiscal_documents CASCADE;
TRUNCATE TABLE public.service_requests CASCADE;
TRUNCATE TABLE public.client_events CASCADE;
TRUNCATE TABLE public.proposals CASCADE;
TRUNCATE TABLE public.payments CASCADE;
TRUNCATE TABLE public.network_diagnostics CASCADE;

-- Nível 1: tabelas principais
TRUNCATE TABLE public.contracts CASCADE;
TRUNCATE TABLE public.quotes CASCADE;
TRUNCATE TABLE public.customers CASCADE;
TRUNCATE TABLE public.budget_leads CASCADE;
TRUNCATE TABLE public.leads CASCADE;

-- Logs e webhooks
TRUNCATE TABLE public.asaas_webhooks CASCADE;
TRUNCATE TABLE public.integration_logs CASCADE;
TRUNCATE TABLE public.logs_sistema CASCADE;
TRUNCATE TABLE public.admin_audit_logs CASCADE;
TRUNCATE TABLE public.security_events CASCADE;

-- Revenue intelligence (dados de teste)
TRUNCATE TABLE public.revenue_intelligence CASCADE;
TRUNCATE TABLE public.prompt_intelligence CASCADE;
