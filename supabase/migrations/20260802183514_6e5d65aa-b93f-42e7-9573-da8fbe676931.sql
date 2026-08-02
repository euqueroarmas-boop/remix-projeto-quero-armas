-- 1. Desativa duplicatas antigas: mantém apenas a notificação mais recente
-- por (cliente, categoria) entre as ativas não urgentes.
WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY cliente_id, categoria ORDER BY created_at DESC) rn
  FROM public.qa_notificacoes_cliente
  WHERE ativa = true AND urgencia <> 'urgente'
)
UPDATE public.qa_notificacoes_cliente n
   SET ativa = false, resolvida_em = now()
  FROM ranked r
 WHERE n.id = r.id AND r.rn > 1;

-- 2. Notificações informativas antigas (mais de 7 dias) deixam de aparecer.
UPDATE public.qa_notificacoes_cliente
   SET ativa = false, resolvida_em = now()
 WHERE ativa = true AND urgencia <> 'urgente' AND created_at < now() - interval '7 days';

-- 3. Cliente pode dispensar definitivamente uma notificação informativa dele.
CREATE OR REPLACE FUNCTION public.qa_notificacao_dispensar(p_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.qa_notificacoes_cliente
     SET ativa = false, resolvida_em = now()
   WHERE id = p_id
     AND ativa = true
     AND urgencia <> 'urgente'
     AND cliente_id = public.qa_current_cliente_id(auth.uid());
END;
$$;
GRANT EXECUTE ON FUNCTION public.qa_notificacao_dispensar(uuid) TO authenticated;