ALTER TABLE public.qa_crafs
  ADD COLUMN IF NOT EXISTS numero_cad_sinarm text,
  ADD COLUMN IF NOT EXISTS numero_registro_sigma text,
  ADD COLUMN IF NOT EXISTS sistema_registro text
    CHECK (sistema_registro IS NULL OR sistema_registro IN ('SINARM','SIGMA','REVISAR'));

ALTER TABLE public.qa_cliente_armas_manual
  ADD COLUMN IF NOT EXISTS numero_cad_sinarm text,
  ADD COLUMN IF NOT EXISTS numero_registro_sigma text,
  ADD COLUMN IF NOT EXISTS sistema_registro text
    CHECK (sistema_registro IS NULL OR sistema_registro IN ('SINARM','SIGMA','REVISAR'));

ALTER TABLE public.qa_documentos_cliente
  ADD COLUMN IF NOT EXISTS numero_cad_sinarm text,
  ADD COLUMN IF NOT EXISTS numero_registro_sigma text,
  ADD COLUMN IF NOT EXISTS sistema_registro text
    CHECK (sistema_registro IS NULL OR sistema_registro IN ('SINARM','SIGMA','REVISAR'));

CREATE INDEX IF NOT EXISTS idx_qa_crafs_cad_sinarm ON public.qa_crafs (numero_cad_sinarm) WHERE numero_cad_sinarm IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_qa_documentos_cliente_cad_sinarm ON public.qa_documentos_cliente (numero_cad_sinarm) WHERE numero_cad_sinarm IS NOT NULL;