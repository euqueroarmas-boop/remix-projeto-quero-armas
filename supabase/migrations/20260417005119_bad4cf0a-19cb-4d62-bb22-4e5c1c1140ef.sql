-- Tabela para registrar quais serviços (catálogo qa_servicos) exigem exames
-- Permite ao admin gerenciar posteriormente quais serviços disparam o monitoramento de exames
CREATE TABLE IF NOT EXISTS public.qa_servicos_com_exame (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  servico_id bigint NOT NULL UNIQUE,
  nome_servico text NOT NULL,
  exige_psicologico boolean NOT NULL DEFAULT true,
  exige_tiro boolean NOT NULL DEFAULT true,
  ativo boolean NOT NULL DEFAULT true,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.qa_servicos_com_exame ENABLE ROW LEVEL SECURITY;

-- Leitura pública autenticada (consumido pelo dashboard interno)
CREATE POLICY "Authenticated users can read qa_servicos_com_exame"
  ON public.qa_servicos_com_exame FOR SELECT
  TO authenticated
  USING (true);

-- Apenas service_role gerencia (admin via painel posteriormente)
CREATE POLICY "Service role manages qa_servicos_com_exame"
  ON public.qa_servicos_com_exame FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_qa_servicos_com_exame_servico_id ON public.qa_servicos_com_exame(servico_id);
CREATE INDEX IF NOT EXISTS idx_qa_servicos_com_exame_ativo ON public.qa_servicos_com_exame(ativo);