ALTER TABLE qa_vendas
  ADD COLUMN IF NOT EXISTS parcelas_cobranca INTEGER,
  ADD COLUMN IF NOT EXISTS valor_cobrado NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS encargos_reais NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS encargos_fracao NUMERIC(8, 6);

COMMENT ON COLUMN qa_vendas.parcelas_cobranca IS
  'Número de parcelas escolhido pelo cliente no checkout. 1 para PIX/Boleto.';

COMMENT ON COLUMN qa_vendas.valor_cobrado IS
  'Valor efetivamente enviado ao Asaas (= valor_a_pagar para PIX/Boleto, > valor_a_pagar quando cartão com juros).';

COMMENT ON COLUMN qa_vendas.encargos_reais IS
  'valor_cobrado - valor_a_pagar. Encargo absorvido pelo cliente em reais.';

COMMENT ON COLUMN qa_vendas.encargos_fracao IS
  'Encargo em fração (0.10 = 10% acima do base). Útil para BI/relatórios.';

ALTER TABLE qa_vendas
  DROP CONSTRAINT IF EXISTS qa_vendas_encargos_nao_negativos;
ALTER TABLE qa_vendas
  ADD CONSTRAINT qa_vendas_encargos_nao_negativos
  CHECK (encargos_reais IS NULL OR encargos_reais >= 0);

CREATE INDEX IF NOT EXISTS idx_qa_vendas_parcelas_cobranca
  ON qa_vendas (parcelas_cobranca)
  WHERE parcelas_cobranca IS NOT NULL;