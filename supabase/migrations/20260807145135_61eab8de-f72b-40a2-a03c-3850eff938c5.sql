-- ============================================================================
-- TRAVA: aprovado exige arquivo próprio
-- Causa: linhas do vocabulário antigo ficavam "aprovadas" apontando para o
-- arquivo de OUTRO tipo de documento (falso positivo silencioso no checklist).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.qa_trava_aprovado_exige_arquivo_processo()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_status text := lower(coalesce(NEW.status, ''));
  v_key text := coalesce(nullif(NEW.arquivo_storage_key, ''), nullif(NEW.arquivo_url, ''));
  v_conflito text;
BEGIN
  IF v_status NOT IN ('aprovado', 'aprovada', 'validado', 'validada', 'conforme') THEN
    RETURN NEW;
  END IF;

  IF v_key IS NULL THEN
    RAISE EXCEPTION
      'Documento % nao pode ser aprovado sem arquivo anexado (processo %).',
      NEW.tipo_documento, NEW.processo_id
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT d.tipo_documento INTO v_conflito
  FROM public.qa_processo_documentos d
  WHERE d.processo_id = NEW.processo_id
    AND d.id <> NEW.id
    AND d.tipo_documento <> NEW.tipo_documento
    AND coalesce(nullif(d.arquivo_storage_key, ''), nullif(d.arquivo_url, '')) = v_key
  LIMIT 1;

  IF v_conflito IS NOT NULL THEN
    RAISE EXCEPTION
      'Documento % nao pode ser aprovado reaproveitando o arquivo de % (processo %).',
      NEW.tipo_documento, v_conflito, NEW.processo_id
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_qa_trava_aprovado_exige_arquivo ON public.qa_processo_documentos;
CREATE TRIGGER trg_qa_trava_aprovado_exige_arquivo
BEFORE INSERT OR UPDATE OF status, arquivo_url, arquivo_storage_key
ON public.qa_processo_documentos
FOR EACH ROW
EXECUTE FUNCTION public.qa_trava_aprovado_exige_arquivo_processo();

-- ---------------------------------------------------------------------------
-- Mesma regra no Hub Documental
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.qa_trava_aprovado_exige_arquivo_hub()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_status text := lower(coalesce(NEW.status, ''));
BEGIN
  IF v_status IN ('aprovado', 'aprovada', 'validado', 'validada', 'conforme')
     AND nullif(NEW.arquivo_storage_path, '') IS NULL THEN
    RAISE EXCEPTION
      'Documento % nao pode ser aprovado sem arquivo anexado (cliente %).',
      NEW.tipo_documento, NEW.qa_cliente_id
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_qa_trava_aprovado_exige_arquivo_hub ON public.qa_documentos_cliente;
CREATE TRIGGER trg_qa_trava_aprovado_exige_arquivo_hub
BEFORE INSERT OR UPDATE OF status, arquivo_storage_path
ON public.qa_documentos_cliente
FOR EACH ROW
EXECUTE FUNCTION public.qa_trava_aprovado_exige_arquivo_hub();