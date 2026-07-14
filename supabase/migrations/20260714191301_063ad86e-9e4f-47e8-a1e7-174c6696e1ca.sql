ALTER TABLE qa_arsenal_assinaturas
  ADD COLUMN IF NOT EXISTS asaas_credit_card_token  text,
  ADD COLUMN IF NOT EXISTS asaas_credit_card_brand  text,
  ADD COLUMN IF NOT EXISTS asaas_credit_card_last4  text,
  ADD COLUMN IF NOT EXISTS asaas_credit_card_holder text,
  ADD COLUMN IF NOT EXISTS asaas_credit_card_expiry text;

NOTIFY pgrst, 'reload schema';