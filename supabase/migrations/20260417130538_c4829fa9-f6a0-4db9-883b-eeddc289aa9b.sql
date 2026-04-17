
-- 0) Resolver colisão: atribuir id_legado único para vendas novas sem legado
--    Usa MAX(id_legado) + offset para evitar qualquer colisão futura.
DO $$
DECLARE
  v_max BIGINT;
  v_rec RECORD;
BEGIN
  SELECT COALESCE(MAX(id_legado), 0) INTO v_max FROM public.qa_vendas;
  FOR v_rec IN SELECT id FROM public.qa_vendas WHERE id_legado IS NULL ORDER BY id LOOP
    v_max := v_max + 1;
    UPDATE public.qa_vendas SET id_legado = v_max WHERE id = v_rec.id;
  END LOOP;
END $$;

-- Mesma estratégia para clientes (defensivo, caso surjam novos sem legado no futuro)
DO $$
DECLARE
  c_max BIGINT;
  c_rec RECORD;
BEGIN
  SELECT COALESCE(MAX(id_legado), 0) INTO c_max FROM public.qa_clientes;
  FOR c_rec IN SELECT id FROM public.qa_clientes WHERE id_legado IS NULL ORDER BY id LOOP
    c_max := c_max + 1;
    UPDATE public.qa_clientes SET id_legado = c_max WHERE id = c_rec.id;
  END LOOP;
END $$;

-- 1) QUARENTENA: itens órfãos
CREATE TABLE IF NOT EXISTS public.qa_itens_venda_orfaos (
  id BIGINT PRIMARY KEY,
  payload JSONB NOT NULL,
  motivo TEXT NOT NULL DEFAULT 'venda_id sem correspondencia em qa_vendas (id ou id_legado)',
  movido_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.qa_itens_venda_orfaos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "qa_itens_venda_orfaos_admin_only" ON public.qa_itens_venda_orfaos;
CREATE POLICY "qa_itens_venda_orfaos_admin_only" ON public.qa_itens_venda_orfaos
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

INSERT INTO public.qa_itens_venda_orfaos (id, payload)
SELECT i.id, to_jsonb(i.*)
FROM public.qa_itens_venda i
WHERE i.venda_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.qa_vendas v WHERE v.id_legado = i.venda_id)
ON CONFLICT (id) DO NOTHING;

DELETE FROM public.qa_itens_venda i
WHERE i.venda_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.qa_vendas v WHERE v.id_legado = i.venda_id);

-- 2) UNIQUE em id_legado
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'qa_clientes_id_legado_unique') THEN
    ALTER TABLE public.qa_clientes ADD CONSTRAINT qa_clientes_id_legado_unique UNIQUE (id_legado);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'qa_vendas_id_legado_unique') THEN
    ALTER TABLE public.qa_vendas   ADD CONSTRAINT qa_vendas_id_legado_unique   UNIQUE (id_legado);
  END IF;
END $$;

-- 3) NOT NULL em id_legado (chave canônica) — garantido pelo backfill acima
ALTER TABLE public.qa_clientes ALTER COLUMN id_legado SET NOT NULL;
ALTER TABLE public.qa_vendas   ALTER COLUMN id_legado SET NOT NULL;

-- 4) FOREIGN KEYS reais (ON DELETE RESTRICT)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'qa_vendas_cliente_id_fk') THEN
    ALTER TABLE public.qa_vendas
      ADD CONSTRAINT qa_vendas_cliente_id_fk
      FOREIGN KEY (cliente_id) REFERENCES public.qa_clientes(id_legado)
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'qa_itens_venda_venda_id_fk') THEN
    ALTER TABLE public.qa_itens_venda
      ADD CONSTRAINT qa_itens_venda_venda_id_fk
      FOREIGN KEY (venda_id) REFERENCES public.qa_vendas(id_legado)
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- 5) Índices de performance
CREATE INDEX IF NOT EXISTS qa_vendas_cliente_id_idx    ON public.qa_vendas (cliente_id);
CREATE INDEX IF NOT EXISTS qa_itens_venda_venda_id_idx ON public.qa_itens_venda (venda_id);
