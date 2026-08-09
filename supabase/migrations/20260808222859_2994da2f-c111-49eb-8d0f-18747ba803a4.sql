CREATE TABLE IF NOT EXISTS public.qa_inatividade_cobrancas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id uuid NOT NULL,
  cliente_id integer NOT NULL,
  semana_num integer NOT NULL,
  dias_parado integer NOT NULL DEFAULT 0,
  canal text NOT NULL DEFAULT 'email_cliente',
  destinatario text,
  status text NOT NULL DEFAULT 'enviado',
  erro_mensagem text,
  detalhes jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS qa_inatividade_cobrancas_uniq
  ON public.qa_inatividade_cobrancas (processo_id, semana_num, canal);
CREATE INDEX IF NOT EXISTS qa_inatividade_cobrancas_cliente_idx
  ON public.qa_inatividade_cobrancas (cliente_id);

GRANT SELECT ON public.qa_inatividade_cobrancas TO authenticated;
GRANT ALL ON public.qa_inatividade_cobrancas TO service_role;

ALTER TABLE public.qa_inatividade_cobrancas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "qa_inatividade_cobrancas_select_auth" ON public.qa_inatividade_cobrancas;
CREATE POLICY "qa_inatividade_cobrancas_select_auth"
  ON public.qa_inatividade_cobrancas FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.qa_painel_progresso_clientes()
RETURNS TABLE (
  processo_id uuid,
  cliente_id integer,
  cliente_nome text,
  cliente_email text,
  servico_nome text,
  status text,
  fase text,
  total_docs integer,
  entregues integer,
  proximo_doc text,
  ultima_atividade timestamptz,
  dias_parado integer,
  cobrancas integer,
  criado_em timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH docs AS (
    SELECT pd.processo_id,
      COUNT(*) FILTER (WHERE COALESCE(pd.obrigatorio, true) AND pd.status <> 'nao_aplicavel')::int AS total,
      COUNT(*) FILTER (WHERE COALESCE(pd.obrigatorio, true) AND pd.status IN ('aprovado','dispensado_grupo','dispensado_por_reaproveitamento'))::int AS ok,
      MAX(pd.data_envio) AS ultimo_envio
    FROM public.qa_processo_documentos pd
    GROUP BY pd.processo_id
  ),
  prox AS (
    SELECT DISTINCT ON (pd.processo_id) pd.processo_id,
      COALESCE(NULLIF(pd.nome_documento,''), pd.tipo_documento) AS nome
    FROM public.qa_processo_documentos pd
    WHERE pd.status = 'pendente' AND COALESCE(pd.obrigatorio, true)
    ORDER BY pd.processo_id, pd.created_at
  ),
  cob AS (
    SELECT c.processo_id, COUNT(*)::int AS qtd
    FROM public.qa_inatividade_cobrancas c
    WHERE c.status = 'enviado'
    GROUP BY c.processo_id
  )
  SELECT
    p.id,
    p.cliente_id,
    cl.nome_completo,
    cl.email,
    p.servico_nome,
    p.status,
    CASE
      WHEN p.status IN ('protocolado','deferido','indeferido','em_exigencia') THEN 'ORGAO'
      WHEN COALESCE(d.total,0) > 0 AND COALESCE(d.ok,0) >= COALESCE(d.total,0) THEN 'PRONTO'
      ELSE 'DOCUMENTOS'
    END,
    COALESCE(d.total,0),
    COALESCE(d.ok,0),
    pr.nome,
    GREATEST(COALESCE(d.ultimo_envio, p.created_at), p.created_at),
    FLOOR(EXTRACT(EPOCH FROM (now() - GREATEST(COALESCE(d.ultimo_envio, p.created_at), p.created_at))) / 86400)::int,
    COALESCE(cb.qtd, 0),
    p.created_at
  FROM public.qa_processos p
  JOIN public.qa_clientes cl ON cl.id = p.cliente_id
  LEFT JOIN docs d ON d.processo_id = p.id
  LEFT JOIN prox pr ON pr.processo_id = p.id
  LEFT JOIN cob cb ON cb.processo_id = p.id
  WHERE p.status NOT IN ('deferido','indeferido','cancelado','arquivado')
    AND COALESCE(cl.status, '') <> 'excluido_lgpd';
$$;

GRANT EXECUTE ON FUNCTION public.qa_painel_progresso_clientes() TO authenticated, service_role;

INSERT INTO public.qa_config (chave, valor, descricao)
VALUES
  ('inatividade_primeira_cobranca_dias', '15', 'Dias sem movimentacao do cliente antes da primeira cobranca automatica'),
  ('inatividade_intervalo_dias', '7', 'Intervalo em dias entre cobrancas automaticas subsequentes')
ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor;