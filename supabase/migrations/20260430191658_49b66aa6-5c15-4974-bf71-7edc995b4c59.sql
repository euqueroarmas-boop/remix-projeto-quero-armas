-- Coluna para marcar e-mail enviado
ALTER TABLE public.qa_solicitacao_eventos
  ADD COLUMN IF NOT EXISTS email_enviado_em TIMESTAMPTZ;

-- Função: já existe evento (com email enviado) para esta combinação status_novo + solicitacao?
CREATE OR REPLACE FUNCTION public.qa_evento_ja_notificado(
  _solicitacao_id UUID,
  _evento TEXT,
  _status_novo TEXT
) RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.qa_solicitacao_eventos e
    WHERE e.solicitacao_id = _solicitacao_id
      AND e.evento = _evento
      AND COALESCE(e.status_novo, '') = COALESCE(_status_novo, '')
      AND e.email_enviado_em IS NOT NULL
      AND NOT EXISTS (
        -- Permite re-envio se houve mudança REAL de status depois deste evento
        SELECT 1 FROM public.qa_solicitacao_eventos posterior
        WHERE posterior.solicitacao_id = _solicitacao_id
          AND posterior.created_at > e.created_at
          AND posterior.evento = 'status_alterado'
          AND posterior.status_novo IS DISTINCT FROM _status_novo
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.qa_evento_ja_notificado(UUID, TEXT, TEXT) TO authenticated, service_role;