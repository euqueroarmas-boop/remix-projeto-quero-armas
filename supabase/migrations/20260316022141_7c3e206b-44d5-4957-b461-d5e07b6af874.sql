
-- Cache de consultas CNPJ
CREATE TABLE public.cnpj_cache (
  cnpj TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Cache de consultas CEP
CREATE TABLE public.cep_cache (
  cep TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: leitura pública (dados não sensíveis)
ALTER TABLE public.cnpj_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cep_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read cnpj_cache" ON public.cnpj_cache FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow public read cep_cache" ON public.cep_cache FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow service insert cnpj_cache" ON public.cnpj_cache FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "Allow service insert cep_cache" ON public.cep_cache FOR INSERT TO service_role WITH CHECK (true);
