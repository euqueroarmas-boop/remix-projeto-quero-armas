
CREATE TABLE IF NOT EXISTS public.qa_notificacao_eventos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  tipo_evento TEXT NOT NULL,
  acao TEXT NOT NULL,
  cliente_id BIGINT NULL,
  venda_id BIGINT NULL,
  contrato_id UUID NULL,
  processo_id UUID NULL,
  documento_id UUID NULL,
  staff_user_id UUID NULL,
  staff_email TEXT NULL,
  notificar_cliente BOOLEAN NOT NULL DEFAULT true,
  canais JSONB NOT NULL DEFAULT '{}'::jsonb,
  motivo_nao_notificar TEXT NULL,
  resultado JSONB NOT NULL DEFAULT '{}'::jsonb,
  payload_resumo JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT qa_notificacao_eventos_tipo_evento_chk
    CHECK (tipo_evento IN (
      'notificacao_policy_definida',
      'notificacao_enviada',
      'notificacao_nao_enviada_por_opcao',
      'notificacao_falhou',
      'whatsapp_nao_configurado',
      'portal_registrado'
    ))
);

GRANT SELECT ON public.qa_notificacao_eventos TO authenticated;
GRANT ALL ON public.qa_notificacao_eventos TO service_role;

ALTER TABLE public.qa_notificacao_eventos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notificacao_eventos_staff_read"
  ON public.qa_notificacao_eventos
  FOR SELECT
  TO authenticated
  USING (public.qa_is_active_staff(auth.uid()));

CREATE INDEX IF NOT EXISTS qa_notif_eventos_cliente_idx ON public.qa_notificacao_eventos(cliente_id, created_at DESC);
CREATE INDEX IF NOT EXISTS qa_notif_eventos_venda_idx ON public.qa_notificacao_eventos(venda_id, created_at DESC);
CREATE INDEX IF NOT EXISTS qa_notif_eventos_contrato_idx ON public.qa_notificacao_eventos(contrato_id, created_at DESC);
CREATE INDEX IF NOT EXISTS qa_notif_eventos_processo_idx ON public.qa_notificacao_eventos(processo_id, created_at DESC);
CREATE INDEX IF NOT EXISTS qa_notif_eventos_acao_idx ON public.qa_notificacao_eventos(acao, created_at DESC);
