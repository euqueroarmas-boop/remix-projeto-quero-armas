CREATE OR REPLACE FUNCTION public.qa_trg_recalc_prazos_upd()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  r record;
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN NULL;
  END IF;
  FOR r IN
    SELECT DISTINCT n.processo_id
      FROM novas n
      JOIN antigas a ON a.id = n.id
     WHERE n.processo_id IS NOT NULL
       AND (n.status IS DISTINCT FROM a.status
            OR n.data_emissao IS DISTINCT FROM a.data_emissao
            OR n.proxima_leitura IS DISTINCT FROM a.proxima_leitura
            OR n.validade_dias IS DISTINCT FROM a.validade_dias
            OR n.data_validade IS DISTINCT FROM a.data_validade)
  LOOP
    BEGIN
      PERFORM public.qa_recalcular_prazos_processo(r.processo_id);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'qa_trg_recalc_prazos_upd falhou: %', SQLERRM;
    END;
  END LOOP;
  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS qa_proc_docs_recalc_prazos_upd ON public.qa_processo_documentos;

CREATE TRIGGER qa_proc_docs_recalc_prazos_upd
AFTER UPDATE ON public.qa_processo_documentos
REFERENCING OLD TABLE AS antigas NEW TABLE AS novas
FOR EACH STATEMENT EXECUTE FUNCTION public.qa_trg_recalc_prazos_upd();