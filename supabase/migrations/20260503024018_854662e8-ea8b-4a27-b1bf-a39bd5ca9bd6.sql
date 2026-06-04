CREATE TABLE IF NOT EXISTS public.qa_vencimentos_alertas_enviados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id integer,
  fonte text NOT NULL,
  ref_id text NOT NULL,
  marco_dias integer NOT NULL,
  canal text NOT NULL,
  destinatario text,
  data_referencia date NOT NULL,
  status text NOT NULL DEFAULT 'enviado',
  erro_mensagem text,
  detalhes jsonb,
  enviado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT qa_venc_alertas_unique UNIQUE (fonte, ref_id, marco_dias, canal, data_referencia)
);

CREATE INDEX IF NOT EXISTS idx_qa_venc_alertas_cliente ON public.qa_vencimentos_alertas_enviados(cliente_id);
CREATE INDEX IF NOT EXISTS idx_qa_venc_alertas_fonte_ref ON public.qa_vencimentos_alertas_enviados(fonte, ref_id);
CREATE INDEX IF NOT EXISTS idx_qa_venc_alertas_enviado_em ON public.qa_vencimentos_alertas_enviados(enviado_em DESC);

ALTER TABLE public.qa_vencimentos_alertas_enviados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "QA admin gerencia venc alertas"
  ON public.qa_vencimentos_alertas_enviados
  FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM qa_usuarios_perfis p WHERE p.user_id = auth.uid() AND p.ativo = true AND p.perfil = 'administrador'))
  WITH CHECK (EXISTS (SELECT 1 FROM qa_usuarios_perfis p WHERE p.user_id = auth.uid() AND p.ativo = true AND p.perfil = 'administrador'));