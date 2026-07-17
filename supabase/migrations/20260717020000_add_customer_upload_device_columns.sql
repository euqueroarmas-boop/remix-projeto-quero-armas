-- Adiciona colunas de rastreio do dispositivo/sessão no momento do upload
-- do contrato assinado pelo cliente (ICP-Brasil / GOV.BR).
ALTER TABLE public.qa_contracts
  ADD COLUMN IF NOT EXISTS customer_upload_ip        text,
  ADD COLUMN IF NOT EXISTS customer_upload_user_agent text,
  ADD COLUMN IF NOT EXISTS customer_upload_device     jsonb;

COMMENT ON COLUMN public.qa_contracts.customer_upload_ip         IS 'IP do cliente no momento do upload do PDF assinado (x-forwarded-for server-side)';
COMMENT ON COLUMN public.qa_contracts.customer_upload_user_agent IS 'User-Agent completo do navegador no upload do PDF assinado';
COMMENT ON COLUMN public.qa_contracts.customer_upload_device     IS 'Metadados extras de sessão: screen, timezone, language, platform';
