-- Motor de notificações persistentes do cliente (popup em qualquer tela do
-- portal, reaparece a cada 10min até a pendência real ser resolvida).
--
-- Categorias automáticas: contrato_pendente (calculado ao vivo, não
-- persistido), exame_psicologico, exame_tiro, cr, craf, gte,
-- autorizacao_compra. Categoria "custom" para notificações manuais criadas
-- pela equipe em Configurações, atreladas a processo/documento.

CREATE TABLE IF NOT EXISTS public.qa_notificacoes_cliente (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id integer NOT NULL REFERENCES public.qa_clientes(id) ON DELETE CASCADE,
  categoria text NOT NULL,
  urgencia text NOT NULL DEFAULT 'normal' CHECK (urgencia IN ('urgente', 'normal')),
  titulo text NOT NULL,
  mensagem text NOT NULL,
  link text,
  referencia_tabela text,
  referencia_id text,
  ativa boolean NOT NULL DEFAULT true,
  origem text NOT NULL DEFAULT 'auto' CHECK (origem IN ('auto', 'manual')),
  criado_por uuid REFERENCES auth.users(id),
  resolvida_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Dedupe: cron roda todo dia, upsert em vez de duplicar a mesma pendência.
  -- Notificações manuais (sem referencia_tabela/id) não colidem entre si
  -- porque cada uma usa um id próprio nesses campos (ver função abaixo).
  UNIQUE (cliente_id, categoria, referencia_tabela, referencia_id)
);

CREATE INDEX IF NOT EXISTS idx_qa_notificacoes_cliente_ativas
  ON public.qa_notificacoes_cliente (cliente_id, ativa) WHERE ativa;

ALTER TABLE public.qa_notificacoes_cliente ENABLE ROW LEVEL SECURITY;

CREATE POLICY qa_notificacoes_cliente_owner_select
  ON public.qa_notificacoes_cliente FOR SELECT TO authenticated
  USING (cliente_id = public.qa_current_cliente_id(auth.uid()));
CREATE POLICY qa_notificacoes_cliente_staff_all
  ON public.qa_notificacoes_cliente FOR ALL TO authenticated
  USING (public.qa_is_active_staff(auth.uid()))
  WITH CHECK (public.qa_is_active_staff(auth.uid()));
CREATE POLICY qa_notificacoes_cliente_service_role
  ON public.qa_notificacoes_cliente FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.qa_notificacoes_cliente_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_qa_notificacoes_cliente_touch
  BEFORE UPDATE ON public.qa_notificacoes_cliente
  FOR EACH ROW EXECUTE FUNCTION public.qa_notificacoes_cliente_touch_updated_at();

-- Combina notificações persistidas (ativa=true) com a checagem ao vivo de
-- contrato pendente de assinatura (não é persistida — o próprio status do
-- contrato já é a fonte da verdade, evita ficar dessincronizado).
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
  WHERE n.cliente_id = p_cliente_id AND n.ativa = true
$$;

GRANT EXECUTE ON FUNCTION public.qa_cliente_notificacoes_ativas(integer) TO authenticated;
