-- Add link to original uploaded file for canonical Arsenal tables.
-- This guarantees that AI-promoted CRAFs/GTEs/Munição NFs preserve the
-- original document for "Visualizar" / "Baixar" inside the Weapon Drawer.

ALTER TABLE public.qa_crafs
  ADD COLUMN IF NOT EXISTS arquivo_storage_path text,
  ADD COLUMN IF NOT EXISTS arquivo_nome text,
  ADD COLUMN IF NOT EXISTS arquivo_mime text,
  ADD COLUMN IF NOT EXISTS documento_origem_id uuid;

CREATE INDEX IF NOT EXISTS idx_qa_crafs_documento_origem
  ON public.qa_crafs (documento_origem_id);

ALTER TABLE public.qa_gte_documentos
  ADD COLUMN IF NOT EXISTS documento_origem_id uuid;

CREATE INDEX IF NOT EXISTS idx_qa_gte_documentos_origem
  ON public.qa_gte_documentos (documento_origem_id);

ALTER TABLE public.qa_municoes_movimentacoes
  ADD COLUMN IF NOT EXISTS documento_origem_id uuid;

CREATE INDEX IF NOT EXISTS idx_qa_municoes_documento_origem
  ON public.qa_municoes_movimentacoes (documento_origem_id);