-- Entrega A — campos aditivos para cadastro público e clientes (Quero Armas)
-- Todas as colunas são NULLABLE para preservar dados existentes (Zero Regression).

-- qa_cadastro_publico
ALTER TABLE public.qa_cadastro_publico
  ADD COLUMN IF NOT EXISTS sexo text,
  ADD COLUMN IF NOT EXISTS naturalidade_municipio text,
  ADD COLUMN IF NOT EXISTS naturalidade_uf text,
  ADD COLUMN IF NOT EXISTS naturalidade_pais text,
  ADD COLUMN IF NOT EXISTS data_expedicao_rg text,
  ADD COLUMN IF NOT EXISTS titulo_eleitor text,
  ADD COLUMN IF NOT EXISTS cnh text,
  ADD COLUMN IF NOT EXISTS ctps text,
  ADD COLUMN IF NOT EXISTS pis_pasep text,
  ADD COLUMN IF NOT EXISTS end1_pais text;

-- qa_clientes
ALTER TABLE public.qa_clientes
  ADD COLUMN IF NOT EXISTS sexo text,
  ADD COLUMN IF NOT EXISTS naturalidade_municipio text,
  ADD COLUMN IF NOT EXISTS naturalidade_uf text,
  ADD COLUMN IF NOT EXISTS naturalidade_pais text,
  ADD COLUMN IF NOT EXISTS cnh text,
  ADD COLUMN IF NOT EXISTS ctps text,
  ADD COLUMN IF NOT EXISTS pis_pasep text;