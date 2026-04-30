-- 1) qa_clientes
ALTER TABLE public.qa_clientes
  ADD COLUMN IF NOT EXISTS tipo_documento_identidade TEXT NOT NULL DEFAULT 'RG';

ALTER TABLE public.qa_clientes
  DROP CONSTRAINT IF EXISTS qa_clientes_tipo_documento_identidade_check;

ALTER TABLE public.qa_clientes
  ADD CONSTRAINT qa_clientes_tipo_documento_identidade_check
  CHECK (tipo_documento_identidade IN ('RG','CIN'));

-- 2) qa_cadastro_publico (fluxo público)
ALTER TABLE public.qa_cadastro_publico
  ADD COLUMN IF NOT EXISTS tipo_documento_identidade TEXT NOT NULL DEFAULT 'RG';

ALTER TABLE public.qa_cadastro_publico
  DROP CONSTRAINT IF EXISTS qa_cadastro_publico_tipo_documento_identidade_check;

ALTER TABLE public.qa_cadastro_publico
  ADD CONSTRAINT qa_cadastro_publico_tipo_documento_identidade_check
  CHECK (tipo_documento_identidade IN ('RG','CIN'));

COMMENT ON COLUMN public.qa_clientes.tipo_documento_identidade IS
  'Tipo do documento de identidade do titular: RG (tradicional) ou CIN (Carteira de Identidade Nacional, que substitui o RG e usa o mesmo número do CPF).';
COMMENT ON COLUMN public.qa_cadastro_publico.tipo_documento_identidade IS
  'Tipo do documento de identidade declarado no cadastro público: RG ou CIN.';