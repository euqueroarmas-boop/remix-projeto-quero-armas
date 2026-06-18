-- Relaxa a condição de auto-aprovação:
-- Aprova qualquer documento onde a IA identificou o tipo com alguma confiança
-- (recomendacao = 'aceitar' ou 'confirmar'). Apenas 'revisao_obrigatoria'
-- (confiança < 0.5 ou documento ilegível) permanece pendente de análise humana.

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

  -- Aprova se a IA identificou o documento (confianca >= 0.5 ou recomendacao != revisao_obrigatoria)
  IF (v_recomendacao IS NOT NULL AND v_recomendacao <> 'revisao_obrigatoria')
     OR v_confianca >= 0.5
  THEN
    NEW.status      := 'aprovado';
    NEW.aprovado_em := now();
  END IF;

  RETURN NEW;
END;
$$;
