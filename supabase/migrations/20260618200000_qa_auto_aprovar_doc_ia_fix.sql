-- Recria a função e trigger de auto-aprovação por IA.
-- A função anterior nunca chegou ao banco (0 rows em pg_proc).
-- Threshold: confianca >= 0.7 OU recomendacao = 'aceitar'.

-- ─── 1. Função BEFORE INSERT ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.qa_doc_auto_aprovar_por_ia()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recomendacao text;
  v_confianca    numeric;
BEGIN
  -- Só age em inserções de documentos do cliente aguardando análise
  IF NEW.status <> 'pendente_aprovacao' OR NEW.origem <> 'cliente' THEN
    RETURN NEW;
  END IF;

  -- Lê campos do JSON de análise da IA
  v_recomendacao := NEW.ia_dados_extraidos->>'recomendacao';
  v_confianca    := (NEW.ia_dados_extraidos->>'confianca')::numeric;

  -- Aprova automaticamente se IA recomenda aceitar OU confiança >= 70%
  IF v_confianca >= 0.7
     OR (v_recomendacao IS NOT NULL AND v_recomendacao = 'aceitar')
  THEN
    NEW.status      := 'aprovado';
    NEW.aprovado_em := now();
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Nunca bloqueia o INSERT; deixa o status original em caso de erro
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.qa_doc_auto_aprovar_por_ia() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.qa_doc_auto_aprovar_por_ia() TO authenticated, service_role;

-- ─── 2. Trigger BEFORE INSERT ─────────────────────────────────────────────────

DROP TRIGGER IF EXISTS qa_doc_auto_aprovar_por_ia_trigger ON public.qa_documentos_cliente;

CREATE TRIGGER qa_doc_auto_aprovar_por_ia_trigger
  BEFORE INSERT ON public.qa_documentos_cliente
  FOR EACH ROW
  EXECUTE FUNCTION public.qa_doc_auto_aprovar_por_ia();

-- ─── 3. Backfill: aprova documentos pendentes que já qualificam ──────────────
-- Inclui o documento 0ed277b0 (confianca=1.0, recomendacao='aceitar')

UPDATE public.qa_documentos_cliente
SET
  status      = 'aprovado',
  aprovado_em = now()
WHERE status  = 'pendente_aprovacao'
  AND origem  = 'cliente'
  AND (
    (ia_dados_extraidos->>'confianca')::numeric >= 0.7
    OR (ia_dados_extraidos->>'recomendacao') = 'aceitar'
  );
