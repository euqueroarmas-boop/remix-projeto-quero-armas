-- Campos de cartão tokenizado na assinatura Arsenal Premium.
-- O token é usado para cobranças de renovação futura via Asaas.
ALTER TABLE qa_arsenal_assinaturas
  ADD COLUMN IF NOT EXISTS asaas_credit_card_token  text,
  ADD COLUMN IF NOT EXISTS asaas_credit_card_brand  text,
  ADD COLUMN IF NOT EXISTS asaas_credit_card_last4  text,
  ADD COLUMN IF NOT EXISTS asaas_credit_card_holder text,
  ADD COLUMN IF NOT EXISTS asaas_credit_card_expiry text; -- formato MM/AA

NOTIFY pgrst, 'reload schema';
