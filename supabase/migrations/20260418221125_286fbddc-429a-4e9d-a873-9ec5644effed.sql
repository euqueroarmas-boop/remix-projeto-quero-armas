ALTER TABLE public.qa_cadastro_publico
  ADD COLUMN IF NOT EXISTS documento_identidade_path text,
  ADD COLUMN IF NOT EXISTS comprovante_endereco_path text;