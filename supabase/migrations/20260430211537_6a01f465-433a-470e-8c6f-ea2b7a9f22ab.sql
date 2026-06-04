ALTER TABLE public.qa_clientes
  ADD COLUMN IF NOT EXISTS portal_provisionado_em timestamptz,
  ADD COLUMN IF NOT EXISTS portal_credenciais_enviadas_em timestamptz,
  ADD COLUMN IF NOT EXISTS portal_ultimo_envio_status text,
  ADD COLUMN IF NOT EXISTS portal_ultimo_envio_erro text;

COMMENT ON COLUMN public.qa_clientes.portal_provisionado_em IS 'Quando o acesso ao Portal foi criado (1ª vez)';
COMMENT ON COLUMN public.qa_clientes.portal_credenciais_enviadas_em IS 'Última vez que e-mail de credenciais foi enviado';
COMMENT ON COLUMN public.qa_clientes.portal_ultimo_envio_status IS 'success | failed';
COMMENT ON COLUMN public.qa_clientes.portal_ultimo_envio_erro IS 'Mensagem da última falha de envio (se houver)';