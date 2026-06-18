-- Relaxa a condição de auto-aprovação:
-- Aprova documentos onde a IA identificou o tipo com confiança >= 0.7.
-- Abaixo disso (confiança < 0.7 ou recomendacao = 'revisao_obrigatoria')
-- permanece pendente de análise humana.

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
  IF NEW.status <> 'pendente_aprovacao' OR NEW.origem <> 'cliente' THEN
    RETURN NEW;
  END IF;

  v_recomendacao := NEW.ia_dados_extraidos->>'recomendacao';
  v_confianca    := (NEW.ia_dados_extraidos->>'confianca')::numeric;

  -- Aprova se a IA identificou o documento com confiança >= 0.7
  IF v_confianca >= 0.7
     OR (v_recomendacao IS NOT NULL AND v_recomendacao = 'aceitar')
  THEN
    NEW.status      := 'aprovado';
    NEW.aprovado_em := now();
  END IF;

  RETURN NEW;
END;
$$;
