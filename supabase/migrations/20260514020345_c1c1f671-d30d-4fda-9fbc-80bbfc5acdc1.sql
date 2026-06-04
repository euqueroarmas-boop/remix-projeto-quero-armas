-- =====================================================================
-- FASE 2B-1 — Preparação aditiva de qa_vendas para vínculo de cobrança
-- Não cria cobrança. Não altera webhook/contrato/checklist.
-- Apenas adiciona colunas e índices novos. Idempotente.
-- =====================================================================

-- Catálogo de status de cobrança suportados (documentação inline):
--   nao_gerada           -- estado inicial implícito (NULL ou 'nao_gerada')
--   aguardando_pagamento -- cobrança criada no Asaas, aguardando pagamento
--   confirmada           -- pagamento confirmado/recebido
--   vencida              -- payment overdue
--   cancelada            -- cobrança cancelada antes do pagamento
--   estornada            -- refunded
--   chargeback           -- chargeback recebido
--   erro                 -- erro ao criar/sincronizar cobrança
--
-- Status de validação de valor (já existentes em status_validacao_valor):
--   pendente | corrigido | aprovado | reprovado
--
-- Status genérico da venda (qa_vendas.status) permanece inalterado nesta fase.

ALTER TABLE public.qa_vendas
  ADD COLUMN IF NOT EXISTS asaas_payment_id      text,
  ADD COLUMN IF NOT EXISTS asaas_customer_id     text,
  ADD COLUMN IF NOT EXISTS asaas_subscription_id text,
  ADD COLUMN IF NOT EXISTS asaas_invoice_url     text,
  ADD COLUMN IF NOT EXISTS asaas_bank_slip_url   text,
  ADD COLUMN IF NOT EXISTS asaas_pix_payload     text,
  ADD COLUMN IF NOT EXISTS asaas_due_date        date,
  ADD COLUMN IF NOT EXISTS cobranca_status       text,
  ADD COLUMN IF NOT EXISTS cobranca_gerada_em    timestamptz,
  ADD COLUMN IF NOT EXISTS cobranca_confirmada_em timestamptz,
  ADD COLUMN IF NOT EXISTS cobranca_origem       text;

COMMENT ON COLUMN public.qa_vendas.asaas_payment_id IS
  'ID da cobrança Asaas vinculada (FASE 2B). NULL = cobrança ainda não gerada.';
COMMENT ON COLUMN public.qa_vendas.cobranca_status IS
  'Estados: nao_gerada | aguardando_pagamento | confirmada | vencida | cancelada | estornada | chargeback | erro';
COMMENT ON COLUMN public.qa_vendas.cobranca_origem IS
  'Origem do registro de cobrança (ex.: equipe_manual, asaas_webhook, conciliacao).';

-- Unicidade do payment_id (apenas quando preenchido) — impede dupla geração
CREATE UNIQUE INDEX IF NOT EXISTS uq_qa_vendas_asaas_payment_id
  ON public.qa_vendas (asaas_payment_id)
  WHERE asaas_payment_id IS NOT NULL;

-- Índices auxiliares para consultas operacionais
CREATE INDEX IF NOT EXISTS idx_qa_vendas_asaas_customer_id
  ON public.qa_vendas (asaas_customer_id)
  WHERE asaas_customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_qa_vendas_cobranca_status
  ON public.qa_vendas (cobranca_status)
  WHERE cobranca_status IS NOT NULL;
