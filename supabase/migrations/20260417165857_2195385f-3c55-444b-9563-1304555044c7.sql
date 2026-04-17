ALTER TABLE public.qa_itens_venda 
  ADD COLUMN IF NOT EXISTS data_notificacao date,
  ADD COLUMN IF NOT EXISTS data_recurso_administrativo date;