CREATE OR REPLACE FUNCTION public.qa_exames_calcular_vencimento()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.data_vencimento := (NEW.data_realizacao + INTERVAL '1 year')::date;
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;

UPDATE public.qa_exames_cliente
SET data_vencimento = (data_realizacao + INTERVAL '1 year')::date,
    updated_at = now()
WHERE data_vencimento IS DISTINCT FROM (data_realizacao + INTERVAL '1 year')::date;

CREATE OR REPLACE VIEW public.qa_exames_cliente_status AS
SELECT
  e.id,
  e.cliente_id,
  e.tipo,
  e.data_realizacao,
  e.data_vencimento,
  e.observacoes,
  e.cadastrado_por,
  e.cadastrado_por_nome,
  e.created_at,
  e.updated_at,
  (e.data_vencimento - CURRENT_DATE) AS dias_restantes,
  CASE
    WHEN e.data_vencimento < CURRENT_DATE THEN 'vencido'::text
    WHEN (e.data_vencimento - CURRENT_DATE) <= 45 THEN 'a_vencer'::text
    ELSE 'vigente'::text
  END AS status,
  CASE
    WHEN e.data_vencimento < CURRENT_DATE THEN NULL::integer
    WHEN (e.data_vencimento - CURRENT_DATE) <= 7 THEN 7
    WHEN (e.data_vencimento - CURRENT_DATE) <= 15 THEN 15
    WHEN (e.data_vencimento - CURRENT_DATE) <= 30 THEN 30
    WHEN (e.data_vencimento - CURRENT_DATE) <= 45 THEN 45
    ELSE NULL::integer
  END AS marco_alerta_atual
FROM public.qa_exames_cliente e;