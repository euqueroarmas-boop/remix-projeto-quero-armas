-- Campos de comprovação de ocupação lícita via CNPJ (Estatuto do
-- Desarmamento). O cliente continua sendo pessoa física — estes campos
-- NÃO cadastram uma empresa como entidade própria, apenas guardam os
-- dados públicos da Receita Federal ligados ao CNPJ que o cliente
-- informou como evidência de ocupação.
ALTER TABLE public.qa_clientes
  ADD COLUMN IF NOT EXISTS ocupacao_licita_cnpj TEXT,
  ADD COLUMN IF NOT EXISTS ocupacao_licita_razao_social TEXT,
  ADD COLUMN IF NOT EXISTS ocupacao_licita_nome_fantasia TEXT,
  ADD COLUMN IF NOT EXISTS ocupacao_licita_atividade TEXT,
  ADD COLUMN IF NOT EXISTS ocupacao_licita_endereco TEXT,
  ADD COLUMN IF NOT EXISTS ocupacao_licita_telefone TEXT;
