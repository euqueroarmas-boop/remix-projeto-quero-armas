-- Recria a view com security_invoker para respeitar RLS do usuário consultando
DROP VIEW IF EXISTS public.qa_exames_cliente_status;

CREATE VIEW public.qa_exames_cliente_status
WITH (security_invoker = true) AS
SELECT id,
    cliente_id,
    tipo,
    data_realizacao,
    data_vencimento,
    observacoes,
    cadastrado_por,
    cadastrado_por_nome,
    created_at,
    updated_at,
    data_vencimento - CURRENT_DATE AS dias_restantes,
        CASE
            WHEN data_vencimento < CURRENT_DATE THEN 'vencido'::text
            WHEN (data_vencimento - CURRENT_DATE) <= 45 THEN 'a_vencer'::text
            ELSE 'vigente'::text
        END AS status,
        CASE
            WHEN data_vencimento < CURRENT_DATE THEN NULL::integer
            WHEN (data_vencimento - CURRENT_DATE) <= 7 THEN 7
            WHEN (data_vencimento - CURRENT_DATE) <= 15 THEN 15
            WHEN (data_vencimento - CURRENT_DATE) <= 30 THEN 30
            WHEN (data_vencimento - CURRENT_DATE) <= 45 THEN 45
            ELSE NULL::integer
        END AS marco_alerta_atual
   FROM public.qa_exames_cliente e;

COMMENT ON VIEW public.qa_exames_cliente_status IS
  'View com security_invoker=true: respeita RLS de qa_exames_cliente do usuário consultante.';