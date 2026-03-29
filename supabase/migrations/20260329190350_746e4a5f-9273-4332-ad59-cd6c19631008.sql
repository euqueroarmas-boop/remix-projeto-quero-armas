
-- Tabela principal para armazenar execuções de testes
CREATE TABLE public.test_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  suite TEXT NOT NULL, -- smoke, frontend, business, forms, contracts, checkout, seo, blog, portal, api, regression, full
  status TEXT NOT NULL DEFAULT 'pending', -- pending, running, success, failed, partial, cancelled
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  duration_ms INTEGER,
  total_tests INTEGER DEFAULT 0,
  passed_tests INTEGER DEFAULT 0,
  failed_tests INTEGER DEFAULT 0,
  skipped_tests INTEGER DEFAULT 0,
  environment TEXT DEFAULT 'production',
  triggered_by TEXT DEFAULT 'admin', -- admin, github, scheduled
  execution_engine TEXT DEFAULT 'edge_function', -- edge_function, github_actions
  base_url TEXT,
  browser TEXT,
  viewport TEXT,
  build_ref TEXT,
  github_run_id TEXT,
  github_run_url TEXT,
  logs JSONB,
  error_message TEXT,
  screenshot_urls TEXT[],
  video_urls TEXT[],
  report_url TEXT,
  results JSONB, -- array detalhado de cada teste: [{name, status, duration, error, screenshot}]
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para consultas do admin
CREATE INDEX idx_test_runs_suite ON public.test_runs (suite);
CREATE INDEX idx_test_runs_status ON public.test_runs (status);
CREATE INDEX idx_test_runs_created_at ON public.test_runs (created_at DESC);

-- RLS: apenas admin autenticado pode ler/escrever
ALTER TABLE public.test_runs ENABLE ROW LEVEL SECURITY;

-- Policy: service_role pode tudo (edge functions usam service_role)
CREATE POLICY "Service role full access on test_runs"
  ON public.test_runs
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Habilitar realtime para acompanhar status em tempo real
ALTER PUBLICATION supabase_realtime ADD TABLE public.test_runs;
