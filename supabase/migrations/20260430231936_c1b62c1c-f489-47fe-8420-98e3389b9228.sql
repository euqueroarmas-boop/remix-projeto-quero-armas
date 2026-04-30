ALTER TABLE public.qa_clientes
  ADD COLUMN IF NOT EXISTS numero_documento_identidade TEXT;

ALTER TABLE public.qa_cadastro_publico
  ADD COLUMN IF NOT EXISTS numero_documento_identidade TEXT;

UPDATE public.qa_clientes
SET numero_documento_identidade = rg
WHERE numero_documento_identidade IS NULL
  AND rg IS NOT NULL;

UPDATE public.qa_cadastro_publico
SET numero_documento_identidade = rg
WHERE numero_documento_identidade IS NULL
  AND rg IS NOT NULL;

COMMENT ON COLUMN public.qa_clientes.numero_documento_identidade IS
  'Número do documento de identidade do titular. Compatível com RG legado e CIN.';
COMMENT ON COLUMN public.qa_cadastro_publico.numero_documento_identidade IS
  'Número do documento de identidade declarado no cadastro público. Compatível com RG legado e CIN.';