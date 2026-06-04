ALTER TABLE public.qa_cadastro_publico
  ADD COLUMN IF NOT EXISTS pago_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS aguardando_cliente_desde DATE,
  ADD COLUMN IF NOT EXISTS dias_pausados INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sla_concluido_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ultima_solicitacao_cliente TEXT;

UPDATE public.qa_cadastro_publico
   SET pago_em = COALESCE(pago_em, updated_at, created_at)
 WHERE pago = true AND pago_em IS NULL;

CREATE INDEX IF NOT EXISTS idx_qa_cadastro_publico_sla
  ON public.qa_cadastro_publico(pago_em)
  WHERE pago = true AND sla_concluido_em IS NULL;