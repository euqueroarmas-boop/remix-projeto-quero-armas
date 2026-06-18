
CREATE OR REPLACE FUNCTION public.qa_doc_auto_aprovar_por_ia()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conf numeric;
  v_reco text;
BEGIN
  IF NEW.status = 'pendente_aprovacao' AND NEW.ia_dados_extraidos IS NOT NULL THEN
    BEGIN
      v_conf := (NEW.ia_dados_extraidos->>'confianca')::numeric;
    EXCEPTION WHEN OTHERS THEN
      v_conf := NULL;
    END;
    v_reco := NEW.ia_dados_extraidos->>'recomendacao';

    IF (v_conf IS NOT NULL AND v_conf >= 0.7) OR v_reco = 'aceitar' THEN
      NEW.status := 'aprovado';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS qa_doc_auto_aprovar_por_ia_trigger ON public.qa_documentos_cliente;
CREATE TRIGGER qa_doc_auto_aprovar_por_ia_trigger
BEFORE INSERT ON public.qa_documentos_cliente
FOR EACH ROW
EXECUTE FUNCTION public.qa_doc_auto_aprovar_por_ia();

-- Backfill retroativo
UPDATE public.qa_documentos_cliente
SET status = 'aprovado'
WHERE status = 'pendente_aprovacao'
  AND ia_dados_extraidos IS NOT NULL
  AND (
    COALESCE((ia_dados_extraidos->>'confianca')::numeric, 0) >= 0.7
    OR ia_dados_extraidos->>'recomendacao' = 'aceitar'
  );
