ALTER TABLE public.qa_itens_venda
  ADD COLUMN IF NOT EXISTS numero_autorizacao text,
  ADD COLUMN IF NOT EXISTS validade_autorizacao date;