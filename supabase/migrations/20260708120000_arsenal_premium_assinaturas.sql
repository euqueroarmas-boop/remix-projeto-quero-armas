-- Arsenal Inteligente Premium — assinatura anual (R$ 297 em 12x no cartão,
-- ou cobrança anual única via PIX/boleto).
--
-- Regras de negócio (definidas em 08/07/2026):
--   • Gratuidade por CPF, concedida UMA única vez:
--       - 3 meses para quem tem serviço Quero Armas pago;
--       - 1 mês para assinante direto.
--   • Renovação anual; avisos por e-mail nos marcos 45..1 dias antes do fim.
--   • 3 dias de carência após o vencimento; depois, status 'suspensa'.
--   • Cancelamento via chamado, 30 dias de aviso prévio (regra operacional).

CREATE TABLE IF NOT EXISTS public.qa_arsenal_assinaturas (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id                  bigint NOT NULL,   -- qa_clientes.id (ID real)
  cpf                         text NOT NULL,     -- dígitos apenas; chave da gratuidade
  status                      text NOT NULL CHECK (status IN
                                ('gratuidade','aguardando_pagamento','ativa','suspensa','cancelada')),
  origem_gratuidade           text CHECK (origem_gratuidade IN
                                ('assinatura_direta','servico_contratado')),
  periodo_inicio              date NOT NULL,
  periodo_fim                 date NOT NULL,
  forma_pagamento             text CHECK (forma_pagamento IN ('CREDIT_CARD','PIX','BOLETO')),
  valor_anual                 numeric NOT NULL DEFAULT 297,
  asaas_payment_id            text,
  asaas_invoice_url           text,
  aceite_contrato_em          timestamptz,
  aceite_contrato_ip          text,
  cancelamento_solicitado_em  timestamptz,
  criado_em                   timestamptz NOT NULL DEFAULT now(),
  atualizado_em               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_arsenal_ass_cliente ON public.qa_arsenal_assinaturas (cliente_id);
CREATE INDEX IF NOT EXISTS idx_arsenal_ass_cpf     ON public.qa_arsenal_assinaturas (cpf);
CREATE INDEX IF NOT EXISTS idx_arsenal_ass_status  ON public.qa_arsenal_assinaturas (status, periodo_fim);

ALTER TABLE public.qa_arsenal_assinaturas ENABLE ROW LEVEL SECURITY;

-- Cliente autenticado enxerga apenas a própria assinatura (mesmo padrão das
-- demais tabelas do portal: qa_current_cliente_id resolve auth.uid() → cliente).
CREATE POLICY arsenal_ass_select ON public.qa_arsenal_assinaturas
  FOR SELECT TO authenticated
  USING (cliente_id = public.qa_current_cliente_id(auth.uid()));

GRANT SELECT ON public.qa_arsenal_assinaturas TO authenticated;
GRANT ALL ON public.qa_arsenal_assinaturas TO service_role;

-- Antiduplicidade dos avisos de renovação (17 marcos: 45..1 + dia 0).
CREATE TABLE IF NOT EXISTS public.qa_arsenal_avisos_enviados (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  assinatura_id  uuid NOT NULL REFERENCES public.qa_arsenal_assinaturas(id) ON DELETE CASCADE,
  periodo_fim    date NOT NULL,
  marco          int NOT NULL,
  canal          text NOT NULL DEFAULT 'email',
  enviado_em     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (assinatura_id, periodo_fim, marco)
);

GRANT ALL ON public.qa_arsenal_avisos_enviados TO service_role;

-- Cron diário 08:00 UTC (05:00 BRT): gratuidade automática, polling de
-- pagamento, avisos de renovação e suspensão pós-carência.
SELECT cron.schedule(
  'qa-arsenal-premium-cron-daily',
  '0 8 * * *',
  $$
  SELECT net.http_post(
    url := 'https://ogkltfqvzweeqkfmrzts.supabase.co/functions/v1/qa-arsenal-premium-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-token', current_setting('app.cron_token', true)
    ),
    body := jsonb_build_object('source','cron','at', now())
  );
  $$
);

NOTIFY pgrst, 'reload schema';
