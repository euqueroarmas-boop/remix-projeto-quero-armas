
-- 1. Adicionar campos para testes por cliente (futuro)
ALTER TABLE public.test_runs
ADD COLUMN client_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
ADD COLUMN client_name TEXT,
ADD COLUMN plan_type TEXT;

CREATE INDEX idx_test_runs_client_id ON public.test_runs (client_id);

-- 2. Tabela de configuração de alertas
CREATE TABLE public.test_alert_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel TEXT NOT NULL, -- whatsapp, email, webhook
  enabled BOOLEAN NOT NULL DEFAULT true,
  config JSONB NOT NULL DEFAULT '{}',
  -- whatsapp: { "phone": "5512999..." }
  -- email: { "to": "admin@wmti.com.br" }
  -- webhook: { "url": "https://...", "method": "POST" }
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.test_alert_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on test_alert_config"
  ON public.test_alert_config
  FOR ALL
  USING (true)
  WITH CHECK (true);
