-- Inverte etapas 3 e 4: 3 = EXAMES TÉCNICOS, 4 = DECLARAÇÕES E COMPROMISSOS
-- Mantém 1 = ENDEREÇO, 2 = ANTECEDENTES.
CREATE OR REPLACE FUNCTION public.qa_etapa_documento(tipo text)
RETURNS smallint
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE public.qa_categoria_documento(tipo)
    WHEN 'endereco'     THEN 1::smallint
    WHEN 'antecedentes' THEN 2::smallint
    WHEN 'exames'       THEN 3::smallint
    WHEN 'declaracoes'  THEN 4::smallint
    ELSE 1::smallint
  END;
$$;

-- Recalcula liberação para todos os processos sob a nova numeração.
SELECT public.qa_recalcular_prazos_processo(id) FROM public.qa_processos;