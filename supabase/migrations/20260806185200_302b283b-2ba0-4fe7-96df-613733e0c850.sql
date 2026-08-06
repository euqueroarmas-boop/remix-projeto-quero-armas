DROP INDEX IF EXISTS public.qa_identidades_funcionais_uniq;
DROP INDEX IF EXISTS public.qa_identidades_funcionais_cliente_idx;

ALTER TABLE public.qa_identidades_funcionais
  ALTER COLUMN qa_cliente_id TYPE integer
  USING qa_cliente_id::text::integer;

ALTER TABLE public.qa_identidades_funcionais
  ADD CONSTRAINT qa_identidades_funcionais_qa_cliente_id_fkey
  FOREIGN KEY (qa_cliente_id)
  REFERENCES public.qa_clientes(id)
  ON DELETE CASCADE;

CREATE UNIQUE INDEX qa_identidades_funcionais_uniq
  ON public.qa_identidades_funcionais (qa_cliente_id, coalesce(numero_documento,''), coalesce(corporacao,''));

CREATE INDEX qa_identidades_funcionais_cliente_idx
  ON public.qa_identidades_funcionais (qa_cliente_id);