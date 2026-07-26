
ALTER TABLE public.qa_notificacoes_cliente
  ADD COLUMN IF NOT EXISTS expira_em timestamptz;

CREATE INDEX IF NOT EXISTS idx_qa_notificacoes_cliente_expira
  ON public.qa_notificacoes_cliente (expira_em) WHERE ativa;

CREATE OR REPLACE FUNCTION public.qa_cliente_notificacoes_ativas(p_cliente_id integer)
RETURNS TABLE (
  id text, categoria text, urgencia text, titulo text, mensagem text,
  link text, created_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    'contrato-' || c.id::text AS id,
    'contrato_pendente' AS categoria,
    'urgente' AS urgencia,
    'Assinatura de contrato pendente' AS titulo,
    'Você tem um contrato aguardando assinatura. O início do atendimento pelo Arsenal Inteligente depende dessa assinatura.' AS mensagem,
    '/area-do-cliente/contratos' AS link,
    c.created_at
  FROM public.qa_contracts c
  WHERE c.cliente_id = p_cliente_id
    AND c.status IN ('generated_pending_company_signature', 'pending_customer_signature')

  UNION ALL

  SELECT
    n.id::text, n.categoria, n.urgencia, n.titulo, n.mensagem, n.link, n.created_at
  FROM public.qa_notificacoes_cliente n
  WHERE n.cliente_id = p_cliente_id
    AND n.ativa = true
    AND (n.expira_em IS NULL OR n.expira_em > now())
$$;

GRANT EXECUTE ON FUNCTION public.qa_cliente_notificacoes_ativas(integer) TO authenticated;
