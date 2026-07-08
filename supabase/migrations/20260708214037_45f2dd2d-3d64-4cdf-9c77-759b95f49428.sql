CREATE TABLE IF NOT EXISTS public.qa_arsenal_assinaturas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id bigint NOT NULL,
  cpf text NOT NULL,
  status text NOT NULL CHECK (status IN ('gratuidade','aguardando_pagamento','ativa','suspensa','cancelada')),
  origem_gratuidade text CHECK (origem_gratuidade IN ('assinatura_direta','servico_contratado')),
  periodo_inicio date NOT NULL,
  periodo_fim date NOT NULL,
  forma_pagamento text CHECK (forma_pagamento IN ('CREDIT_CARD','PIX','BOLETO')),
  valor_anual numeric NOT NULL DEFAULT 297,
  asaas_payment_id text,
  asaas_invoice_url text,
  aceite_contrato_em timestamptz,
  aceite_contrato_ip text,
  cancelamento_solicitado_em timestamptz,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.qa_arsenal_assinaturas TO authenticated;
GRANT ALL ON public.qa_arsenal_assinaturas TO service_role;

ALTER TABLE public.qa_arsenal_assinaturas ENABLE ROW LEVEL SECURITY;

CREATE POLICY arsenal_ass_select ON public.qa_arsenal_assinaturas
  FOR SELECT TO authenticated
  USING (cliente_id = public.qa_current_cliente_id(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_arsenal_ass_cliente ON public.qa_arsenal_assinaturas (cliente_id);
CREATE INDEX IF NOT EXISTS idx_arsenal_ass_cpf ON public.qa_arsenal_assinaturas (cpf);
CREATE INDEX IF NOT EXISTS idx_arsenal_ass_status ON public.qa_arsenal_assinaturas (status, periodo_fim);

CREATE TABLE IF NOT EXISTS public.qa_arsenal_avisos_enviados (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  assinatura_id uuid NOT NULL REFERENCES public.qa_arsenal_assinaturas(id) ON DELETE CASCADE,
  periodo_fim date NOT NULL,
  marco int NOT NULL,
  canal text NOT NULL DEFAULT 'email',
  enviado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (assinatura_id, periodo_fim, marco)
);

GRANT ALL ON public.qa_arsenal_avisos_enviados TO service_role;
ALTER TABLE public.qa_arsenal_avisos_enviados ENABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';