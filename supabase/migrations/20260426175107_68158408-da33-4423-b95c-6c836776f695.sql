-- 1) qa_casos.cliente_id (idempotente — coluna já existe, mas garantimos FK e index)
ALTER TABLE public.qa_casos
  ADD COLUMN IF NOT EXISTS cliente_id bigint;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'qa_casos_cliente_id_fkey'
  ) THEN
    ALTER TABLE public.qa_casos
      ADD CONSTRAINT qa_casos_cliente_id_fkey
      FOREIGN KEY (cliente_id) REFERENCES public.qa_clientes(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_qa_casos_cliente_id ON public.qa_casos(cliente_id);

-- 2) qa_geracoes_pecas: vínculo com caso e cliente
ALTER TABLE public.qa_geracoes_pecas
  ADD COLUMN IF NOT EXISTS caso_id uuid,
  ADD COLUMN IF NOT EXISTS cliente_id bigint;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'qa_geracoes_pecas_caso_id_fkey'
  ) THEN
    ALTER TABLE public.qa_geracoes_pecas
      ADD CONSTRAINT qa_geracoes_pecas_caso_id_fkey
      FOREIGN KEY (caso_id) REFERENCES public.qa_casos(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'qa_geracoes_pecas_cliente_id_fkey'
  ) THEN
    ALTER TABLE public.qa_geracoes_pecas
      ADD CONSTRAINT qa_geracoes_pecas_cliente_id_fkey
      FOREIGN KEY (cliente_id) REFERENCES public.qa_clientes(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_qa_geracoes_pecas_caso_id ON public.qa_geracoes_pecas(caso_id);
CREATE INDEX IF NOT EXISTS idx_qa_geracoes_pecas_cliente_id ON public.qa_geracoes_pecas(cliente_id);

-- 3) Backfill: tentar derivar cliente_id em casos antigos pelo CPF (best-effort)
UPDATE public.qa_casos c
SET cliente_id = cl.id
FROM public.qa_clientes cl
WHERE c.cliente_id IS NULL
  AND c.cpf_cnpj IS NOT NULL
  AND regexp_replace(c.cpf_cnpj, '\D', '', 'g') = regexp_replace(cl.cpf, '\D', '', 'g')
  AND regexp_replace(c.cpf_cnpj, '\D', '', 'g') <> '';

-- 4) Backfill: derivar caso_id e cliente_id em qa_geracoes_pecas via qa_casos.geracao_id (1:1 atual)
UPDATE public.qa_geracoes_pecas g
SET caso_id = c.id,
    cliente_id = COALESCE(g.cliente_id, c.cliente_id)
FROM public.qa_casos c
WHERE c.geracao_id = g.id
  AND g.caso_id IS NULL;