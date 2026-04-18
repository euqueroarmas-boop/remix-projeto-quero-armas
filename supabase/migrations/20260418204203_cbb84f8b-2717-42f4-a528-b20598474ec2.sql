-- Histórico de atualizações dos clientes Quero Armas
CREATE TABLE IF NOT EXISTS public.qa_cliente_historico_atualizacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id integer NOT NULL,
  cadastro_publico_id uuid NULL,
  changed_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- ex.: [{"field":"email","old":"a@x.com","new":"b@x.com","label":"E-mail"}, ...]
  snapshot_anterior jsonb NOT NULL DEFAULT '{}'::jsonb,
  snapshot_novo jsonb NOT NULL DEFAULT '{}'::jsonb,
  origem text NOT NULL DEFAULT 'cadastro_publico',
  autor text NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qa_cliente_hist_cliente
  ON public.qa_cliente_historico_atualizacoes (cliente_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_qa_cliente_hist_cadastro
  ON public.qa_cliente_historico_atualizacoes (cadastro_publico_id);

ALTER TABLE public.qa_cliente_historico_atualizacoes ENABLE ROW LEVEL SECURITY;

-- Admin/serviços autenticados podem ler tudo
DROP POLICY IF EXISTS "qa_hist_select_auth" ON public.qa_cliente_historico_atualizacoes;
CREATE POLICY "qa_hist_select_auth"
  ON public.qa_cliente_historico_atualizacoes
  FOR SELECT
  TO authenticated
  USING (true);

-- Admin/serviços autenticados podem inserir
DROP POLICY IF EXISTS "qa_hist_insert_auth" ON public.qa_cliente_historico_atualizacoes;
CREATE POLICY "qa_hist_insert_auth"
  ON public.qa_cliente_historico_atualizacoes
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
