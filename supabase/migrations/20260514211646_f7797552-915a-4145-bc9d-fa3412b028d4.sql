-- FASE 2C-7.1 — Idempotência correta de qa_solicitacoes_servico
-- Pré-check de duplicidades já executado: 0 duplicatas em (item_venda_id) e (venda_id, servico_id) com cadastro_publico_id IS NULL.

-- 1) Idempotência natural por item de venda
CREATE UNIQUE INDEX IF NOT EXISTS uq_qa_solicitacoes_item_venda
  ON public.qa_solicitacoes_servico (item_venda_id)
  WHERE item_venda_id IS NOT NULL;

-- 2) Fallback por venda + serviço (e-commerce sem item_venda_id explícito)
CREATE UNIQUE INDEX IF NOT EXISTS uq_qa_solicitacoes_venda_servico
  ON public.qa_solicitacoes_servico (venda_id, servico_id)
  WHERE venda_id IS NOT NULL
    AND servico_id IS NOT NULL
    AND cadastro_publico_id IS NULL;

-- 3) Restringe o índice legado (cliente + slug) ao fluxo manual sem venda
DROP INDEX IF EXISTS public.uq_qa_solicitacoes_cli_slug_manual;
CREATE UNIQUE INDEX uq_qa_solicitacoes_cli_slug_manual
  ON public.qa_solicitacoes_servico (cliente_id, service_slug)
  WHERE cadastro_publico_id IS NULL
    AND venda_id IS NULL;