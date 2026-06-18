ALTER TABLE public.qa_documentos_cliente
  ADD COLUMN IF NOT EXISTS resultado_certidao text
  CHECK (resultado_certidao IS NULL OR resultado_certidao IN ('nada_consta', 'consta_apontamento'));

CREATE OR REPLACE FUNCTION public.qa_doc_sync_resultado_certidao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_resultado text;
BEGIN
  IF NEW.ia_dados_extraidos IS NOT NULL THEN
    v_resultado := NEW.ia_dados_extraidos->'camposExtraidos'->>'resultado_certidao';
    IF v_resultado IN ('nada_consta', 'consta_apontamento') THEN
      NEW.resultado_certidao := v_resultado;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.qa_doc_sync_resultado_certidao() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.qa_doc_sync_resultado_certidao() TO authenticated, service_role;

DROP TRIGGER IF EXISTS qa_doc_sync_resultado_certidao_trigger ON public.qa_documentos_cliente;

CREATE TRIGGER qa_doc_sync_resultado_certidao_trigger
  BEFORE INSERT OR UPDATE OF ia_dados_extraidos ON public.qa_documentos_cliente
  FOR EACH ROW
  EXECUTE FUNCTION public.qa_doc_sync_resultado_certidao();

UPDATE public.qa_documentos_cliente
SET resultado_certidao = (
  CASE ia_dados_extraidos->'camposExtraidos'->>'resultado_certidao'
    WHEN 'nada_consta'        THEN 'nada_consta'
    WHEN 'consta_apontamento' THEN 'consta_apontamento'
    ELSE NULL
  END
)
WHERE ia_dados_extraidos IS NOT NULL
  AND ia_dados_extraidos->'camposExtraidos'->>'resultado_certidao'
      IN ('nada_consta', 'consta_apontamento');