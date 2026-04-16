
-- Tabela principal de exames (histórico imutável)
CREATE TABLE public.qa_exames_cliente (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id BIGINT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('psicologico', 'tiro')),
  data_realizacao DATE NOT NULL,
  data_vencimento DATE NOT NULL,
  observacoes TEXT,
  cadastrado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  cadastrado_por_nome TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_qa_exames_cliente_cliente_id ON public.qa_exames_cliente(cliente_id);
CREATE INDEX idx_qa_exames_cliente_tipo ON public.qa_exames_cliente(tipo);
CREATE INDEX idx_qa_exames_cliente_vencimento ON public.qa_exames_cliente(data_vencimento);
CREATE INDEX idx_qa_exames_cliente_cliente_tipo_data ON public.qa_exames_cliente(cliente_id, tipo, data_realizacao DESC);

-- Trigger para calcular automaticamente a data de vencimento (data_realizacao + 365 dias)
CREATE OR REPLACE FUNCTION public.qa_exames_calcular_vencimento()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.data_vencimento := NEW.data_realizacao + INTERVAL '365 days';
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_qa_exames_calcular_vencimento
BEFORE INSERT OR UPDATE OF data_realizacao ON public.qa_exames_cliente
FOR EACH ROW
EXECUTE FUNCTION public.qa_exames_calcular_vencimento();

-- View com status calculado dinamicamente
CREATE OR REPLACE VIEW public.qa_exames_cliente_status AS
SELECT
  e.*,
  (e.data_vencimento - CURRENT_DATE) AS dias_restantes,
  CASE
    WHEN e.data_vencimento < CURRENT_DATE THEN 'vencido'
    WHEN e.data_vencimento - CURRENT_DATE <= 45 THEN 'a_vencer'
    ELSE 'vigente'
  END AS status,
  CASE
    WHEN e.data_vencimento < CURRENT_DATE THEN NULL
    WHEN e.data_vencimento - CURRENT_DATE <= 7 THEN 7
    WHEN e.data_vencimento - CURRENT_DATE <= 15 THEN 15
    WHEN e.data_vencimento - CURRENT_DATE <= 30 THEN 30
    WHEN e.data_vencimento - CURRENT_DATE <= 45 THEN 45
    ELSE NULL
  END AS marco_alerta_atual
FROM public.qa_exames_cliente e;

-- Tabela de controle de alertas enviados (evita duplicidade)
CREATE TABLE public.qa_exames_alertas_enviados (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  exame_id UUID NOT NULL REFERENCES public.qa_exames_cliente(id) ON DELETE CASCADE,
  marco_dias INTEGER NOT NULL CHECK (marco_dias IN (45, 30, 15, 7, 0)),
  canal TEXT NOT NULL CHECK (canal IN ('email_cliente', 'dashboard_interno', 'email_operacao')),
  enviado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  detalhes JSONB,
  UNIQUE(exame_id, marco_dias, canal)
);

CREATE INDEX idx_qa_exames_alertas_exame_id ON public.qa_exames_alertas_enviados(exame_id);

-- RLS
ALTER TABLE public.qa_exames_cliente ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qa_exames_alertas_enviados ENABLE ROW LEVEL SECURITY;

-- Políticas: usuários autenticados (admin do Quero Armas) podem tudo
CREATE POLICY "Authenticated can view exames"
ON public.qa_exames_cliente FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert exames"
ON public.qa_exames_cliente FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can update exames observacoes"
ON public.qa_exames_cliente FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated can delete exames"
ON public.qa_exames_cliente FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated can view alertas"
ON public.qa_exames_alertas_enviados FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert alertas"
ON public.qa_exames_alertas_enviados FOR INSERT TO authenticated WITH CHECK (true);

-- Service role bypass (para edge functions)
CREATE POLICY "Service role full access exames"
ON public.qa_exames_cliente FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access alertas"
ON public.qa_exames_alertas_enviados FOR ALL TO service_role USING (true) WITH CHECK (true);
