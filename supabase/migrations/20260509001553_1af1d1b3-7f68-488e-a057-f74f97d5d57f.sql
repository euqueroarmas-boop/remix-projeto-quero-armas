-- Cadastro público
ALTER TABLE public.qa_cadastro_publico
  ADD COLUMN IF NOT EXISTS comprovante_endereco_em_nome_proprio text,
  ADD COLUMN IF NOT EXISTS responsavel_endereco_nome text,
  ADD COLUMN IF NOT EXISTS responsavel_endereco_cpf text,
  ADD COLUMN IF NOT EXISTS responsavel_endereco_rg_cin text,
  ADD COLUMN IF NOT EXISTS responsavel_endereco_telefone text,
  ADD COLUMN IF NOT EXISTS responsavel_endereco_email text,
  ADD COLUMN IF NOT EXISTS responsavel_endereco_vinculo text,
  ADD COLUMN IF NOT EXISTS responsavel_endereco_declaracao_path text,
  ADD COLUMN IF NOT EXISTS responsavel_endereco_comprovante_path text,
  ADD COLUMN IF NOT EXISTS end2_observacao text;

-- Cliente canônico
ALTER TABLE public.qa_clientes
  ADD COLUMN IF NOT EXISTS comprovante_endereco_em_nome_proprio text,
  ADD COLUMN IF NOT EXISTS responsavel_endereco_nome text,
  ADD COLUMN IF NOT EXISTS responsavel_endereco_cpf text,
  ADD COLUMN IF NOT EXISTS responsavel_endereco_rg_cin text,
  ADD COLUMN IF NOT EXISTS responsavel_endereco_telefone text,
  ADD COLUMN IF NOT EXISTS responsavel_endereco_email text,
  ADD COLUMN IF NOT EXISTS responsavel_endereco_vinculo text,
  ADD COLUMN IF NOT EXISTS responsavel_endereco_declaracao_path text,
  ADD COLUMN IF NOT EXISTS responsavel_endereco_comprovante_path text,
  ADD COLUMN IF NOT EXISTS end2_tipo text,
  ADD COLUMN IF NOT EXISTS end2_observacao text;

-- Restringe valores válidos do flag (só sim|nao|null)
ALTER TABLE public.qa_cadastro_publico
  DROP CONSTRAINT IF EXISTS qa_cadastro_publico_compr_end_nome_chk;
ALTER TABLE public.qa_cadastro_publico
  ADD CONSTRAINT qa_cadastro_publico_compr_end_nome_chk
  CHECK (comprovante_endereco_em_nome_proprio IS NULL
         OR comprovante_endereco_em_nome_proprio IN ('sim','nao'));

ALTER TABLE public.qa_clientes
  DROP CONSTRAINT IF EXISTS qa_clientes_compr_end_nome_chk;
ALTER TABLE public.qa_clientes
  ADD CONSTRAINT qa_clientes_compr_end_nome_chk
  CHECK (comprovante_endereco_em_nome_proprio IS NULL
         OR comprovante_endereco_em_nome_proprio IN ('sim','nao'));