CREATE TABLE public.qa_cliente_ciencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id bigint,
  cadastro_publico_id bigint,
  processo_id bigint,
  termo_codigo text NOT NULL,
  termo_versao text NOT NULL,
  termo_titulo text NOT NULL,
  termo_texto text NOT NULL,
  termo_hash text NOT NULL,
  aceito_em timestamptz NOT NULL DEFAULT now(),
  ip text,
  user_agent text,
  accept_language text,
  referer text,
  origem text NOT NULL DEFAULT 'area_do_cliente',
  metadados jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_qa_cliente_ciencias_cliente ON public.qa_cliente_ciencias (cliente_id, aceito_em DESC);
CREATE INDEX idx_qa_cliente_ciencias_cadastro ON public.qa_cliente_ciencias (cadastro_publico_id, aceito_em DESC);
CREATE INDEX idx_qa_cliente_ciencias_termo ON public.qa_cliente_ciencias (termo_codigo, aceito_em DESC);

GRANT SELECT ON public.qa_cliente_ciencias TO authenticated;
GRANT ALL ON public.qa_cliente_ciencias TO service_role;

ALTER TABLE public.qa_cliente_ciencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Equipe autenticada le ciencias"
ON public.qa_cliente_ciencias
FOR SELECT
TO authenticated
USING (true);