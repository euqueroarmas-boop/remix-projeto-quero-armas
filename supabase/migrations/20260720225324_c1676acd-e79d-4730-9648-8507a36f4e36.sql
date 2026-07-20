
CREATE TABLE IF NOT EXISTS public.qa_filiacao_alertas_enviados (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cliente_id INTEGER NOT NULL REFERENCES public.qa_clientes(id) ON DELETE CASCADE,
  filiacao_id INTEGER REFERENCES public.qa_filiacoes(id) ON DELETE CASCADE,
  clube_id INTEGER,
  marco_dias INTEGER NOT NULL,
  template_name TEXT NOT NULL,
  data_referencia DATE,
  enviado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_qa_filiacao_alertas_dedupe
  ON public.qa_filiacao_alertas_enviados(cliente_id, COALESCE(filiacao_id, 0), marco_dias, template_name, COALESCE(data_referencia, DATE '1900-01-01'));

CREATE INDEX IF NOT EXISTS idx_qa_filiacao_alertas_cliente
  ON public.qa_filiacao_alertas_enviados(cliente_id);

GRANT SELECT ON public.qa_filiacao_alertas_enviados TO authenticated;
GRANT ALL ON public.qa_filiacao_alertas_enviados TO service_role;

ALTER TABLE public.qa_filiacao_alertas_enviados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qa_filiacao_alertas_admin_select"
  ON public.qa_filiacao_alertas_enviados FOR SELECT TO authenticated
  USING (qa_has_qa_perfil(auth.uid(), ARRAY['administrador'::text]));
