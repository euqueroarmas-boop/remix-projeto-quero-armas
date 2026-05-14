ALTER TABLE public.qa_vendas
  ADD COLUMN IF NOT EXISTS checkout_token_hash text,
  ADD COLUMN IF NOT EXISTS checkout_token_expires_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_qa_vendas_checkout_token_hash
  ON public.qa_vendas (checkout_token_hash)
  WHERE checkout_token_hash IS NOT NULL;

COMMENT ON COLUMN public.qa_vendas.checkout_token_hash IS
  'SHA-256 hex hash do token público de checkout. Token cru nunca é persistido. Usado por qa-checkout-iniciar-pagamento para autorizar cliente anônimo.';
COMMENT ON COLUMN public.qa_vendas.checkout_token_expires_at IS
  'TTL do checkout_token (tipicamente 48h após criação da venda no checkout público).';