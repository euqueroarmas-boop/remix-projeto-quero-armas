-- Persistência temporária da senha de portal (24h) para o cliente
-- copiar/colar na tela de conclusão do checkout. Limpa-se sozinha após
-- expirar ou após o cliente trocar a senha. Texto puro é necessário
-- porque o usuário precisa ver a senha — restrito por RLS estrita
-- (apenas service_role lê via edge function).

ALTER TABLE public.qa_clientes
  ADD COLUMN IF NOT EXISTS senha_temporaria TEXT,
  ADD COLUMN IF NOT EXISTS senha_temporaria_expira_em TIMESTAMPTZ;

COMMENT ON COLUMN public.qa_clientes.senha_temporaria IS
  'Senha temporária gerada no provisionamento de portal (texto puro, TTL curto). Somente service_role lê. Limpa após expiração ou primeiro login.';

CREATE INDEX IF NOT EXISTS qa_clientes_senha_temp_expira_idx
  ON public.qa_clientes (senha_temporaria_expira_em)
  WHERE senha_temporaria IS NOT NULL;