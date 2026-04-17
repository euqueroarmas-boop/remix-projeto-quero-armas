-- Categorização legal de titulares (Lei 10.826/03 art. 6º, Decreto 11.615/23, IN 201 DG/PF)
ALTER TABLE public.qa_clientes
  ADD COLUMN IF NOT EXISTS categoria_titular text NULL,
  ADD COLUMN IF NOT EXISTS subcategoria text NULL,
  ADD COLUMN IF NOT EXISTS orgao_vinculado text NULL,
  ADD COLUMN IF NOT EXISTS matricula_funcional text NULL;

-- Constraint para garantir valores válidos (permite NULL para legados)
ALTER TABLE public.qa_clientes
  DROP CONSTRAINT IF EXISTS qa_clientes_categoria_titular_check;

ALTER TABLE public.qa_clientes
  ADD CONSTRAINT qa_clientes_categoria_titular_check
  CHECK (categoria_titular IS NULL OR categoria_titular IN (
    'pessoa_fisica',
    'pessoa_juridica',
    'seguranca_publica',
    'magistrado_mp',
    'militar'
  ));

CREATE INDEX IF NOT EXISTS idx_qa_clientes_categoria_titular
  ON public.qa_clientes (categoria_titular);

COMMENT ON COLUMN public.qa_clientes.categoria_titular IS
  'Categoria legal do titular conforme Lei 10.826/03 art. 6º. NULL = pendente reclassificação. Define quais documentos/exames são exigidos.';
COMMENT ON COLUMN public.qa_clientes.subcategoria IS
  'Subcategoria específica (ex: "Policial Civil", "Juiz Federal", "Sargento EB"). Lista fixa por categoria.';
COMMENT ON COLUMN public.qa_clientes.orgao_vinculado IS
  'Nome do órgão/instituição (ex: "Polícia Civil/SP", "TJSP", "Exército Brasileiro").';
COMMENT ON COLUMN public.qa_clientes.matricula_funcional IS
  'Matrícula funcional ou identidade institucional do titular.';