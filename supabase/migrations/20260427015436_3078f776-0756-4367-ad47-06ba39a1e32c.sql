ALTER TABLE public.qa_armamentos_catalogo
  ADD COLUMN IF NOT EXISTS imagem_validacao_motivo text,
  ADD COLUMN IF NOT EXISTS imagem_validada_em timestamptz;