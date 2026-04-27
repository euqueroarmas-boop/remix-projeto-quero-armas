
CREATE TABLE IF NOT EXISTS public.qa_cadastro_publico_recusados (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cadastro_original_id UUID,
  nome_completo TEXT,
  cpf TEXT,
  telefone_principal TEXT,
  email TEXT,
  end1_cidade TEXT,
  end1_estado TEXT,
  servico_interesse TEXT,
  pago BOOLEAN,
  motivo_recusa TEXT,
  payload_original JSONB,
  recusado_por UUID,
  recusado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  cadastro_created_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.qa_cadastro_publico_recusados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "QA staff podem ver recusados"
ON public.qa_cadastro_publico_recusados FOR SELECT
TO authenticated
USING (public.qa_is_active_staff(auth.uid()));

CREATE POLICY "QA staff podem inserir recusados"
ON public.qa_cadastro_publico_recusados FOR INSERT
TO authenticated
WITH CHECK (public.qa_is_active_staff(auth.uid()));

CREATE POLICY "QA staff podem atualizar recusados"
ON public.qa_cadastro_publico_recusados FOR UPDATE
TO authenticated
USING (public.qa_is_active_staff(auth.uid()));

CREATE POLICY "QA staff podem deletar recusados"
ON public.qa_cadastro_publico_recusados FOR DELETE
TO authenticated
USING (public.qa_is_active_staff(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_qa_cadastro_recusados_created
  ON public.qa_cadastro_publico_recusados (recusado_em DESC);
