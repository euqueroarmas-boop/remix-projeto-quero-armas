ALTER TABLE public.qa_casos
  ADD COLUMN IF NOT EXISTS indeferimento_texto TEXT,
  ADD COLUMN IF NOT EXISTS indeferimento_analise JSONB;