CREATE OR REPLACE FUNCTION public.qa_exigencias_retroativas()
RETURNS TABLE(processo_id uuid, retroativa boolean, criada_em timestamptz)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
WITH entregas AS (
  SELECT d.processo_id, max(d.data_envio) AS ultima_entrega
  FROM public.qa_processo_documentos d
  WHERE d.data_envio IS NOT NULL
  GROUP BY d.processo_id
),
novas AS (
  SELECT d.processo_id, max(d.created_at) AS criada_em
  FROM public.qa_processo_documentos d
  JOIN entregas e ON e.processo_id = d.processo_id
  WHERE d.data_envio IS NULL
    AND lower(coalesce(d.status,'')) NOT IN ('dispensado_grupo','nao_aplicavel','aprovado','entregue')
    AND d.created_at > e.ultima_entrega
  GROUP BY d.processo_id
)
SELECT n.processo_id, true AS retroativa, n.criada_em FROM novas n;
$function$;

GRANT EXECUTE ON FUNCTION public.qa_exigencias_retroativas() TO authenticated, service_role;