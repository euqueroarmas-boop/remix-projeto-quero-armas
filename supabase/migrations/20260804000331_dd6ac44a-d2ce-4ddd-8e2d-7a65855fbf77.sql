CREATE OR REPLACE FUNCTION public.qa_trg_recalc_prazos_stmt()
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
  FOR r IN SELECT DISTINCT processo_id FROM afetadas WHERE processo_id IS NOT NULL
  LOOP
    BEGIN
      PERFORM public.qa_recalcular_prazos_processo(r.processo_id);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'qa_trg_recalc_prazos_stmt falhou: %', SQLERRM;
    END;
  END LOOP;
  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS qa_proc_docs_recalc_prazos ON public.qa_processo_documentos;
DROP TRIGGER IF EXISTS qa_proc_docs_recalc_prazos_ins ON public.qa_processo_documentos;
DROP TRIGGER IF EXISTS qa_proc_docs_recalc_prazos_del ON public.qa_processo_documentos;

CREATE TRIGGER qa_proc_docs_recalc_prazos_ins
AFTER INSERT ON public.qa_processo_documentos
REFERENCING NEW TABLE AS afetadas
FOR EACH STATEMENT EXECUTE FUNCTION public.qa_trg_recalc_prazos_stmt();

CREATE TRIGGER qa_proc_docs_recalc_prazos_del
AFTER DELETE ON public.qa_processo_documentos
REFERENCING OLD TABLE AS afetadas
FOR EACH STATEMENT EXECUTE FUNCTION public.qa_trg_recalc_prazos_stmt();