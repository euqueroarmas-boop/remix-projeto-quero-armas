ALTER TABLE public.qa_clientes
  ADD COLUMN IF NOT EXISTS ocupacao_licita_cnpj TEXT,
  ADD COLUMN IF NOT EXISTS ocupacao_licita_razao_social TEXT,
  ADD COLUMN IF NOT EXISTS ocupacao_licita_nome_fantasia TEXT,
  ADD COLUMN IF NOT EXISTS ocupacao_licita_atividade TEXT,
  ADD COLUMN IF NOT EXISTS ocupacao_licita_endereco TEXT,
  ADD COLUMN IF NOT EXISTS ocupacao_licita_telefone TEXT;

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