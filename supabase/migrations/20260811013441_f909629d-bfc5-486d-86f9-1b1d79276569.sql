ALTER TABLE public.email_send_log ADD COLUMN IF NOT EXISTS resolvido_por_message_id text;
CREATE INDEX IF NOT EXISTS idx_email_send_log_resolvido ON public.email_send_log (status, resolvido_por_message_id);

DROP FUNCTION IF EXISTS public.qa_email_disparos_resumo();
DROP FUNCTION IF EXISTS public.qa_email_painel(timestamp with time zone, timestamp with time zone, text, text, text, integer, integer);
DROP FUNCTION IF EXISTS public.qa_email_por_cliente(timestamp with time zone, timestamp with time zone, integer);
DROP FUNCTION IF EXISTS public.qa_email_por_cliente_detalhe(text, timestamp with time zone, timestamp with time zone, integer);

CREATE OR REPLACE FUNCTION public.qa_email_disparos_resumo()
RETURNS TABLE(total bigint, hoje bigint, falhas bigint, falhas_historicas bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH latest AS (
    SELECT DISTINCT ON (message_id) message_id, status, created_at, resolvido_por_message_id
    FROM public.email_send_log
    WHERE message_id IS NOT NULL
    ORDER BY message_id, created_at DESC
  )
  SELECT
    count(*)::bigint,
    count(*) FILTER (WHERE created_at >= date_trunc('day', now()))::bigint,
    count(*) FILTER (WHERE status IN ('dlq','failed','bounced','complained') AND resolvido_por_message_id IS NULL)::bigint,
    count(*) FILTER (WHERE status IN ('dlq','failed','bounced','complained'))::bigint
  FROM latest;
$function$;

CREATE OR REPLACE FUNCTION public.qa_email_painel(_desde timestamp with time zone DEFAULT NULL::timestamp with time zone, _ate timestamp with time zone DEFAULT NULL::timestamp with time zone, _template text DEFAULT NULL::text, _status text DEFAULT NULL::text, _busca text DEFAULT NULL::text, _limite integer DEFAULT 100, _offset integer DEFAULT 0)
RETURNS TABLE(message_id text, template_name text, recipient_email text, status text, error_message text, assunto text, created_at timestamp with time zone, resolvido_por_message_id text, total_filtrado bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH latest AS (
    SELECT DISTINCT ON (l.message_id)
      l.message_id, l.template_name, l.recipient_email, l.status, l.error_message, l.created_at, l.resolvido_por_message_id
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
      AND (
        _status IS NULL
        OR (_status = 'falha_pendente' AND la.status IN ('dlq','failed','bounced','complained') AND la.resolvido_por_message_id IS NULL)
        OR (_status = 'falha_resolvida' AND la.status IN ('dlq','failed','bounced','complained') AND la.resolvido_por_message_id IS NOT NULL)
        OR la.status = _status
      )
      AND (_busca IS NULL OR la.recipient_email ILIKE '%' || _busca || '%')
  )
  SELECT f.message_id, f.template_name, f.recipient_email, f.status, f.error_message,
         f.assunto, f.created_at, f.resolvido_por_message_id, count(*) OVER ()::bigint
  FROM filtrado f
  ORDER BY f.created_at DESC
  LIMIT coalesce(_limite, 100) OFFSET coalesce(_offset, 0);
$function$;

CREATE OR REPLACE FUNCTION public.qa_email_por_cliente(_desde timestamp with time zone DEFAULT NULL::timestamp with time zone, _ate timestamp with time zone DEFAULT NULL::timestamp with time zone, _limite integer DEFAULT 200)
RETURNS TABLE(recipient_email text, cliente_nome text, cliente_id integer, total bigint, enviados bigint, falhas bigint, falhas_resolvidas bigint, ultimo timestamp with time zone)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH latest AS (
    SELECT DISTINCT ON (l.message_id)
      l.message_id, l.recipient_email, l.status, l.created_at, l.resolvido_por_message_id
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
         count(*) FILTER (WHERE f.status IN ('dlq','failed','bounced','complained') AND f.resolvido_por_message_id IS NULL)::bigint,
         count(*) FILTER (WHERE f.status IN ('dlq','failed','bounced','complained') AND f.resolvido_por_message_id IS NOT NULL)::bigint,
         max(f.created_at)
  FROM f
  LEFT JOIN public.qa_clientes c ON lower(c.email) = lower(f.recipient_email)
  GROUP BY f.recipient_email
  ORDER BY max(f.created_at) DESC
  LIMIT coalesce(_limite, 200);
$function$;

CREATE OR REPLACE FUNCTION public.qa_email_por_cliente_detalhe(_email text, _desde timestamp with time zone DEFAULT NULL::timestamp with time zone, _ate timestamp with time zone DEFAULT NULL::timestamp with time zone, _limite integer DEFAULT 100)
RETURNS TABLE(message_id text, template_name text, status text, error_message text, assunto text, created_at timestamp with time zone, resolvido_por_message_id text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH latest AS (
    SELECT DISTINCT ON (l.message_id)
      l.message_id, l.template_name, l.recipient_email, l.status, l.error_message, l.created_at, l.resolvido_por_message_id
    FROM public.email_send_log l
    WHERE l.message_id IS NOT NULL AND lower(l.recipient_email) = lower(_email)
    ORDER BY l.message_id, l.created_at DESC
  )
  SELECT la.message_id, la.template_name, la.status, la.error_message,
    (SELECT c.subject FROM public.email_content_log c WHERE c.message_id = la.message_id ORDER BY c.created_at DESC LIMIT 1),
    la.created_at, la.resolvido_por_message_id
  FROM latest la
  WHERE (_desde IS NULL OR la.created_at >= _desde)
    AND (_ate IS NULL OR la.created_at <= _ate)
  ORDER BY la.created_at DESC
  LIMIT coalesce(_limite, 100);
$function$;