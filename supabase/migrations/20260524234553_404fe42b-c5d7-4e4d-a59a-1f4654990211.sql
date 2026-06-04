CREATE OR REPLACE FUNCTION public.qa_cliente_arquivar(p_cliente_id integer, p_motivo text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF NOT public.qa_is_active_staff(v_uid) THEN
    RAISE EXCEPTION 'Sem permissão para arquivar cliente';
  END IF;

  UPDATE public.qa_clientes
     SET arquivado = true,
         arquivado_em = now(),
         arquivado_por = v_uid,
         motivo_arquivamento = COALESCE(NULLIF(trim(p_motivo), ''), 'Arquivamento por vínculos críticos (vendas/processos).')
   WHERE id = p_cliente_id;

  RETURN jsonb_build_object('ok', true, 'cliente_id', p_cliente_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.qa_cliente_restaurar(p_cliente_id integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF NOT public.qa_is_active_staff(v_uid) THEN
    RAISE EXCEPTION 'Sem permissão para restaurar cliente';
  END IF;

  UPDATE public.qa_clientes
     SET arquivado = false,
         arquivado_em = NULL,
         arquivado_por = NULL,
         motivo_arquivamento = NULL
   WHERE id = p_cliente_id;

  RETURN jsonb_build_object('ok', true, 'cliente_id', p_cliente_id);
END;
$function$;