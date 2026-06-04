-- Ajustar cliente_id para o tipo real de qa_clientes.id (integer)
ALTER TABLE public.qa_ia_correcoes_juridicas
  ALTER COLUMN cliente_id DROP DEFAULT,
  ALTER COLUMN cliente_id TYPE integer USING NULL;

-- Index para lookup rápido por cliente
CREATE INDEX IF NOT EXISTS idx_qa_ia_correcoes_cliente_id
  ON public.qa_ia_correcoes_juridicas(cliente_id)
  WHERE cliente_id IS NOT NULL;