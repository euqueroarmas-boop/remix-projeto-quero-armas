
CREATE TABLE IF NOT EXISTS public.qa_habitualidade_alertas_enviados (
  id BIGSERIAL PRIMARY KEY,
  cliente_id INTEGER NOT NULL,
  template_name TEXT NOT NULL,
  nivel_atual TEXT,
  nivel_sugerido TEXT,
  treinos_validos INTEGER,
  competicoes_validas INTEGER,
  tipo_arma_ancora TEXT,
  periodo_ref DATE,
  marco_hash TEXT NOT NULL,
  enviado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (cliente_id, template_name, marco_hash)
);

GRANT SELECT, INSERT ON public.qa_habitualidade_alertas_enviados TO authenticated;
GRANT ALL ON public.qa_habitualidade_alertas_enviados TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.qa_habitualidade_alertas_enviados_id_seq TO service_role;

ALTER TABLE public.qa_habitualidade_alertas_enviados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin lê dedupe habitualidade" ON public.qa_habitualidade_alertas_enviados;
CREATE POLICY "admin lê dedupe habitualidade"
  ON public.qa_habitualidade_alertas_enviados
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.qa_usuarios_perfis p
      WHERE p.user_id = auth.uid() AND p.perfil = 'administrador'
    )
  );

CREATE INDEX IF NOT EXISTS idx_qa_hab_alertas_cliente
  ON public.qa_habitualidade_alertas_enviados (cliente_id, template_name);
CREATE INDEX IF NOT EXISTS idx_qa_hab_alertas_enviado_em
  ON public.qa_habitualidade_alertas_enviados (enviado_em DESC);
