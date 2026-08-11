CREATE OR REPLACE FUNCTION public.qa_email_por_cliente(_desde timestamptz DEFAULT NULL, _ate timestamptz DEFAULT NULL, _limite integer DEFAULT 200)
RETURNS TABLE(recipient_email text, cliente_nome text, cliente_id integer, total bigint, enviados bigint, falhas bigint, ultimo timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  WITH latest AS (
    SELECT DISTINCT ON (l.message_id)
      l.message_id, l.recipient_email, l.status, l.created_at
    FROM public.email_send_log l
    WHERE l.message_id IS NOT NULL
    ORDER BY l.message_id, l.created_at DESC
  ), f AS (
    SELECT * FROM latest
    WHERE (_desde IS NULL OR created_at >= _desde)
      AND (_ate IS NULL OR created_at <= _ate)
  )
  SELECT f.recipient_email,
         max(c.nome_completo)::text,
         max(c.id)::integer,
         count(*)::bigint,
         count(*) FILTER (WHERE f.status = 'sent')::bigint,
         count(*) FILTER (WHERE f.status IN ('dlq','failed','bounced','complained'))::bigint,
         max(f.created_at)
  FROM f
  LEFT JOIN public.qa_clientes c ON lower(c.email) = lower(f.recipient_email)
  GROUP BY f.recipient_email
  ORDER BY max(f.created_at) DESC
  LIMIT coalesce(_limite, 200);
$$;

CREATE OR REPLACE FUNCTION public.qa_email_por_cliente_detalhe(_email text, _desde timestamptz DEFAULT NULL, _ate timestamptz DEFAULT NULL, _limite integer DEFAULT 100)
RETURNS TABLE(message_id text, template_name text, status text, error_message text, assunto text, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  WITH latest AS (
    SELECT DISTINCT ON (l.message_id)
      l.message_id, l.template_name, l.recipient_email, l.status, l.error_message, l.created_at
    FROM public.email_send_log l
    WHERE l.message_id IS NOT NULL AND lower(l.recipient_email) = lower(_email)
    ORDER BY l.message_id, l.created_at DESC
  )
  SELECT la.message_id, la.template_name, la.status, la.error_message,
    (SELECT c.subject FROM public.email_content_log c WHERE c.message_id = la.message_id ORDER BY c.created_at DESC LIMIT 1),
    la.created_at
  FROM latest la
  WHERE (_desde IS NULL OR la.created_at >= _desde)
    AND (_ate IS NULL OR la.created_at <= _ate)
  ORDER BY la.created_at DESC
  LIMIT coalesce(_limite, 100);
$$;

REVOKE ALL ON FUNCTION public.qa_email_por_cliente(timestamptz, timestamptz, integer) FROM public, anon;
REVOKE ALL ON FUNCTION public.qa_email_por_cliente_detalhe(text, timestamptz, timestamptz, integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.qa_email_por_cliente(timestamptz, timestamptz, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.qa_email_por_cliente_detalhe(text, timestamptz, timestamptz, integer) TO authenticated, service_role;