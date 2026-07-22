-- Separa o endereço da empresa (Ocupação Lícita/CNPJ) em campos
-- individuais — antes vinha como uma única string concatenada
-- (logradouro + número + bairro + cidade + estado + CEP na mesma linha).
ALTER TABLE public.qa_clientes
  ADD COLUMN IF NOT EXISTS ocupacao_licita_logradouro TEXT,
  ADD COLUMN IF NOT EXISTS ocupacao_licita_numero TEXT,
  ADD COLUMN IF NOT EXISTS ocupacao_licita_complemento TEXT,
  ADD COLUMN IF NOT EXISTS ocupacao_licita_bairro TEXT,
  ADD COLUMN IF NOT EXISTS ocupacao_licita_cidade TEXT,
  ADD COLUMN IF NOT EXISTS ocupacao_licita_estado TEXT,
  ADD COLUMN IF NOT EXISTS ocupacao_licita_cep TEXT;

ALTER TABLE public.qa_clientes
  DROP COLUMN IF EXISTS ocupacao_licita_endereco;
