CREATE TABLE IF NOT EXISTS public.qa_asaas_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key text NOT NULL UNIQUE,
  event text NOT NULL,
  asaas_payment_id text NULL,
  external_reference text NULL,
  venda_id bigint NULL,
  status text NOT NULL DEFAULT 'received',
  processed_at timestamptz NULL,
  payload jsonb NULL,
  error_message text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qa_asaas_webhook_events_venda_id ON public.qa_asaas_webhook_events(venda_id);
CREATE INDEX IF NOT EXISTS idx_qa_asaas_webhook_events_payment_id ON public.qa_asaas_webhook_events(asaas_payment_id);
CREATE INDEX IF NOT EXISTS idx_qa_asaas_webhook_events_status ON public.qa_asaas_webhook_events(status);

ALTER TABLE public.qa_asaas_webhook_events ENABLE ROW LEVEL SECURITY;

-- Sem policies: acessível somente via service_role (edge functions).
COMMENT ON TABLE public.qa_asaas_webhook_events IS 'FASE 2C-1: idempotência e auditoria do webhook qa-asaas-webhook. Acesso somente service_role.';
COMMENT ON COLUMN public.qa_asaas_webhook_events.event_key IS 'Chave canônica: event:payment_id:external_reference';
COMMENT ON COLUMN public.qa_asaas_webhook_events.status IS 'received | processing | success | ignored | mismatch | error';