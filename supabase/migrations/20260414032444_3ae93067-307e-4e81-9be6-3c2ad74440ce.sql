ALTER TABLE public.qa_itens_venda
  ADD COLUMN IF NOT EXISTS data_vencimento date,
  ADD COLUMN IF NOT EXISTS numero_craf text,
  ADD COLUMN IF NOT EXISTS numero_gte text,
  ADD COLUMN IF NOT EXISTS numero_cr text,
  ADD COLUMN IF NOT EXISTS numero_posse text,
  ADD COLUMN IF NOT EXISTS numero_porte text,
  ADD COLUMN IF NOT EXISTS numero_sigma text,
  ADD COLUMN IF NOT EXISTS numero_sinarm text,
  ADD COLUMN IF NOT EXISTS registro_cad text;