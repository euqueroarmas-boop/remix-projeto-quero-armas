CREATE OR REPLACE FUNCTION public.qa_carimbos_conexao_cliente(_cliente_id integer)
RETURNS TABLE (
  ocorrido_em timestamptz,
  origem text,
  evento text,
  referencia text,
  ip text,
  user_agent text,
  detalhe text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH cli AS (
    SELECT id, lower(coalesce(email, '')) AS email, user_id
    FROM public.qa_clientes WHERE id = _cliente_id
  )
  SELECT e.created_at, 'ACESSO AO PORTAL', upper(coalesce(e.origem, 'LOGIN')),
         coalesce(e.email, ''), e.ip, e.user_agent,
         nullif(concat_ws(' · ', e.dispositivo, e.navegador, e.sistema, e.local_aproximado), '')
  FROM public.qa_cliente_login_eventos e, cli
  WHERE (cli.email <> '' AND lower(e.email) = cli.email) OR (cli.user_id IS NOT NULL AND e.user_id = cli.user_id)

  UNION ALL
  SELECT c.created_at, 'CIÊNCIA / ACEITE', upper(coalesce(c.termo_codigo, 'ACEITE')),
         coalesce(c.termo_titulo, ''), c.ip, c.user_agent, c.termo_hash
  FROM public.qa_cliente_ciencias c WHERE c.cliente_id = _cliente_id

  UNION ALL
  SELECT a.created_at, 'DOCUMENTO (EQUIPE)', upper(coalesce(a.acao, 'ACESSO')),
         coalesce(a.documento_nome, a.documento_tipo, ''), a.ip, a.user_agent, NULL
  FROM public.qa_documento_acessos a WHERE a.cliente_id = _cliente_id

  UNION ALL
  SELECT d.baixado_em, 'DOWNLOAD', 'DOWNLOAD',
         coalesce(d.numero, d.documento_tipo, ''), d.ip, d.user_agent, d.sha256
  FROM public.qa_documento_downloads d WHERE d.cliente_id = _cliente_id

  UNION ALL
  SELECT ev.created_at, 'ENTREGA DE DOCUMENTO', upper(coalesce(ev.acao, 'EVENTO')),
         coalesce(ev.ator_email, ev.ator_tipo, ''), ev.ip_origem, ev.user_agent, NULL
  FROM public.qa_documentos_cliente_eventos ev WHERE ev.qa_cliente_id = _cliente_id

  UNION ALL
  SELECT coalesce(en.aprovado_cliente_em, en.updated_at), 'EFETIVA NECESSIDADE', 'APROVAÇÃO DO CLIENTE',
         coalesce(en.status, ''), en.aprovacao_ip, en.aprovacao_user_agent, en.aprovacao_hash
  FROM public.qa_efetiva_necessidade en
  WHERE en.cliente_id = _cliente_id AND en.aprovacao_ip IS NOT NULL

  UNION ALL
  SELECT au.created_at, 'EFETIVA NECESSIDADE', upper(coalesce(au.acao, 'AUDITORIA')),
         coalesce(au.autor_nome, au.autor_tipo, ''), au.ip, au.user_agent, au.observacao
  FROM public.qa_efetiva_necessidade_auditoria au WHERE au.cliente_id = _cliente_id

  UNION ALL
  SELECT ct.created_at, 'CONTRATO', 'ACEITE',
         coalesce(ct.template_codigo, ''), ct.aceite_ip, ct.aceite_user_agent, ct.conteudo_hash
  FROM public.qa_contract_aceites_log ct WHERE ct.cliente_id = _cliente_id

  UNION ALL
  SELECT sg.created_at, 'SENHA GOV.BR', upper(coalesce(sg.acao, 'ACESSO')),
         coalesce(sg.contexto, ''), sg.ip, sg.user_agent, NULL
  FROM public.qa_senha_gov_acessos sg WHERE sg.cliente_id = _cliente_id

  UNION ALL
  SELECT cr.created_at, 'CREDENCIAIS', upper(coalesce(cr.acao, 'ALTERAÇÃO')),
         coalesce(cr.tipo_credencial, ''), cr.ip, cr.user_agent, cr.status_resultado
  FROM public.qa_cliente_credenciais_audit cr WHERE cr.cliente_id = _cliente_id

  ORDER BY 1 DESC NULLS LAST
  LIMIT 1000;
$$;

GRANT EXECUTE ON FUNCTION public.qa_carimbos_conexao_cliente(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.qa_carimbos_conexao_cliente(integer) TO service_role;

CREATE OR REPLACE FUNCTION public.qa_email_painel(
  _desde timestamptz DEFAULT NULL,
  _ate timestamptz DEFAULT NULL,
  _template text DEFAULT NULL,
  _status text DEFAULT NULL,
  _busca text DEFAULT NULL,
  _limite integer DEFAULT 100,
  _offset integer DEFAULT 0
)
RETURNS TABLE (
  message_id text,
  template_name text,
  recipient_email text,
  status text,
  error_message text,
  assunto text,
  created_at timestamptz,
  total_filtrado bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH latest AS (
    SELECT DISTINCT ON (l.message_id)
      l.message_id, l.template_name, l.recipient_email, l.status, l.error_message, l.created_at
    FROM public.email_send_log l
    WHERE l.message_id IS NOT NULL
    ORDER BY l.message_id, l.created_at DESC
  ),
  filtrado AS (
    SELECT la.*,
      (SELECT c.subject FROM public.email_content_log c
        WHERE c.message_id = la.message_id ORDER BY c.created_at DESC LIMIT 1) AS assunto
    FROM latest la
    WHERE (_desde IS NULL OR la.created_at >= _desde)
      AND (_ate IS NULL OR la.created_at <= _ate)
      AND (_template IS NULL OR la.template_name = _template)
      AND (_status IS NULL OR la.status = _status)
      AND (_busca IS NULL OR la.recipient_email ILIKE '%' || _busca || '%')
  )
  SELECT f.message_id, f.template_name, f.recipient_email, f.status, f.error_message,
         f.assunto, f.created_at, count(*) OVER ()::bigint
  FROM filtrado f
  ORDER BY f.created_at DESC
  LIMIT coalesce(_limite, 100) OFFSET coalesce(_offset, 0);
$$;

GRANT EXECUTE ON FUNCTION public.qa_email_painel(timestamptz, timestamptz, text, text, text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.qa_email_painel(timestamptz, timestamptz, text, text, text, integer, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.qa_email_painel_facetas()
RETURNS TABLE (templates text[], statuses text[])
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (SELECT array_agg(DISTINCT template_name ORDER BY template_name)
       FROM public.email_send_log WHERE template_name IS NOT NULL),
    (SELECT array_agg(DISTINCT status ORDER BY status)
       FROM public.email_send_log WHERE status IS NOT NULL);
$$;

GRANT EXECUTE ON FUNCTION public.qa_email_painel_facetas() TO authenticated;
GRANT EXECUTE ON FUNCTION public.qa_email_painel_facetas() TO service_role;