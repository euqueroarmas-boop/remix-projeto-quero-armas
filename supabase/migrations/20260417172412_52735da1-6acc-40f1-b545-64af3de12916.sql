ALTER TABLE public.qa_itens_venda
  ADD COLUMN IF NOT EXISTS numero_registro text,
  ADD COLUMN IF NOT EXISTS numero_serie text,
  ADD COLUMN IF NOT EXISTS fabricante text,
  ADD COLUMN IF NOT EXISTS modelo text,
  ADD COLUMN IF NOT EXISTS calibre text;