CREATE OR REPLACE FUNCTION public.qa_email_disparos_resumo()
RETURNS TABLE (total bigint, hoje bigint, falhas bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH latest AS (
    SELECT DISTINCT ON (message_id) message_id, status, created_at
    FROM public.email_send_log
    WHERE message_id IS NOT NULL
    ORDER BY message_id, created_at DESC
  )
  SELECT
    count(*)::bigint AS total,
    count(*) FILTER (WHERE created_at >= date_trunc('day', now()))::bigint AS hoje,
    count(*) FILTER (WHERE status IN ('dlq','failed','bounced'))::bigint AS falhas
  FROM latest;
$$;

GRANT EXECUTE ON FUNCTION public.qa_email_disparos_resumo() TO authenticated;
GRANT EXECUTE ON FUNCTION public.qa_email_disparos_resumo() TO service_role;