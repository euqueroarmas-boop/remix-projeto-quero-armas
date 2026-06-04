-- Fase 1: Extensão aditiva para metadados completos de documentos
-- NÃO altera comportamento existente. Todas as colunas são opcionais.

-- 1) qa_processo_documentos
ALTER TABLE public.qa_processo_documentos
  ADD COLUMN IF NOT EXISTS metadados_documento_json jsonb,
  ADD COLUMN IF NOT EXISTS campos_complementares_json jsonb,
  ADD COLUMN IF NOT EXISTS titular_comprovante_nome text,
  ADD COLUMN IF NOT EXISTS titular_comprovante_documento text,
  ADD COLUMN IF NOT EXISTS endereco_em_nome_de_terceiro boolean NOT NULL DEFAULT false;

-- 2) qa_documentos_cliente (mesmos campos)
ALTER TABLE public.qa_documentos_cliente
  ADD COLUMN IF NOT EXISTS metadados_documento_json jsonb,
  ADD COLUMN IF NOT EXISTS campos_complementares_json jsonb,
  ADD COLUMN IF NOT EXISTS titular_comprovante_nome text,
  ADD COLUMN IF NOT EXISTS titular_comprovante_documento text,
  ADD COLUMN IF NOT EXISTS endereco_em_nome_de_terceiro boolean NOT NULL DEFAULT false;

-- 3) qa_clientes — registro de endereço em nome de terceiro
ALTER TABLE public.qa_clientes
  ADD COLUMN IF NOT EXISTS endereco_em_nome_de_terceiro boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS endereco_titular_nome text,
  ADD COLUMN IF NOT EXISTS endereco_titular_documento text;

-- Índices leves para consultas auditoriais futuras (opcionais, GIN em jsonb)
CREATE INDEX IF NOT EXISTS idx_qa_processo_documentos_metadados_gin
  ON public.qa_processo_documentos USING GIN (metadados_documento_json);

CREATE INDEX IF NOT EXISTS idx_qa_documentos_cliente_metadados_gin
  ON public.qa_documentos_cliente USING GIN (metadados_documento_json);