CREATE OR REPLACE FUNCTION public.qa_proc_doc_sync_validade()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v RECORD;
  declarada date;
BEGIN
  SELECT * INTO v
  FROM public.qa_validade_documentos
  WHERE tipo_documento = lower(trim(NEW.tipo_documento)) AND ativo
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- prazo do catálogo sempre em dias, para a UI
  NEW.validade_dias := CASE
    WHEN v.perpetuo OR v.validade_dias = 0 THEN NULL
    WHEN v.unidade = 'meses' THEN v.validade_dias * 30
    ELSE v.validade_dias
  END;

  -- data declarada pelo próprio documento (extraída pela IA) tem prioridade
  BEGIN
    declarada := NULLIF(NEW.extracao_ia_json->>'data_validade', '')::date;
  EXCEPTION WHEN others THEN
    declarada := NULL;
  END;

  IF v.perpetuo OR v.validade_dias = 0 THEN
    NEW.data_validade := NULL;
  ELSIF declarada IS NOT NULL THEN
    NEW.data_validade := declarada;
  ELSIF NEW.data_emissao IS NOT NULL THEN
    NEW.data_validade := public.qa_calcular_validade(NEW.tipo_documento, NEW.data_emissao);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_qa_proc_doc_sync_validade ON public.qa_processo_documentos;
CREATE TRIGGER trg_qa_proc_doc_sync_validade
BEFORE INSERT OR UPDATE OF tipo_documento, data_emissao, extracao_ia_json, status
ON public.qa_processo_documentos
FOR EACH ROW
EXECUTE FUNCTION public.qa_proc_doc_sync_validade();