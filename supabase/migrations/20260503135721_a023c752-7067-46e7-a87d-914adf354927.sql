BEGIN;
ALTER TABLE public.qa_clientes DROP COLUMN IF EXISTS cliente_legado;
ALTER TABLE public.qa_clientes DROP COLUMN IF EXISTS tentativa_compra_legado_count;
ALTER TABLE public.qa_clientes DROP COLUMN IF EXISTS tentativa_compra_legado_em;
COMMIT;