ALTER TABLE public.qa_itens_venda
  ADD COLUMN IF NOT EXISTS cortesia boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cortesia_motivo text;