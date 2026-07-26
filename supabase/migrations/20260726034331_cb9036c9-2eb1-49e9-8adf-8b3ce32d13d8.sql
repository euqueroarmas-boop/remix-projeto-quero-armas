
ALTER TABLE public.qa_notificacoes_cliente
  ADD COLUMN IF NOT EXISTS is_teste boolean NOT NULL DEFAULT false;

-- Desativa notificação de teste após primeira visualização (chamada pelo overlay do portal do cliente).
CREATE OR REPLACE FUNCTION public.qa_notificacao_marcar_vista(p_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.qa_notificacoes_cliente
     SET ativa = false, resolvida_em = now()
   WHERE id = p_id
     AND is_teste = true
     AND ativa = true
     AND cliente_id = public.qa_current_cliente_id(auth.uid());
END;
$$;
GRANT EXECUTE ON FUNCTION public.qa_notificacao_marcar_vista(uuid) TO authenticated;

-- Limpa notificação de teste órfã já criada
DELETE FROM public.qa_notificacoes_cliente WHERE id = 'ce003117-9d69-4d84-be59-6c3fb88cb99d';
