-- Arsenal Premium: cartão obrigatório na adesão.
-- card_verificado: R$0,01 cobrado e confirmado na Asaas.
-- asaas_verificacao_payment_id: ID do pagamento de R$0,01 para auditoria.
ALTER TABLE qa_arsenal_assinaturas
  ADD COLUMN IF NOT EXISTS card_verificado              boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS asaas_verificacao_payment_id text;

NOTIFY pgrst, 'reload schema';
