ALTER TABLE public.qa_arsenal_assinaturas
  ADD COLUMN IF NOT EXISTS card_verificado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS asaas_verificacao_payment_id text;

NOTIFY pgrst, 'reload schema';