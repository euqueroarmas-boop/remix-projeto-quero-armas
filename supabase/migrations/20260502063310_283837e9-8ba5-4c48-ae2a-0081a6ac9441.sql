-- =========================================================================
-- 5 ETAPAS: 1 Endereço · 2 Condição Profissional · 3 Antecedentes · 4 Declarações · 5 Exames
-- =========================================================================

-- 1) Categoria: reconhece "condicao_profissional" para itens de renda
CREATE OR REPLACE FUNCTION public.qa_categoria_documento(tipo text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN tipo IS NULL THEN 'outros'
    WHEN tipo LIKE 'comprovante_endereco%' THEN 'endereco'
    -- Renda / condição profissional (inclui placeholder "renda_definir_condicao")
    WHEN tipo = 'renda_definir_condicao' THEN 'condicao_profissional'
    WHEN tipo LIKE 'renda_%' THEN 'condicao_profissional'
    WHEN tipo LIKE 'certidao%' OR tipo ILIKE '%antecedentes%' THEN 'antecedentes'
    WHEN tipo LIKE 'declaracao%' OR tipo ILIKE '%compromisso%' THEN 'declaracoes'
    WHEN tipo ILIKE '%laudo%' OR tipo ILIKE '%tiro%' OR tipo ILIKE '%aptidao%' OR tipo ILIKE '%psicologic%' OR tipo ILIKE '%capacidade_tecnica%' THEN 'exames'
    ELSE 'outros'
  END;
$function$;

-- 2) Etapa: 5 fases na ordem definitiva
CREATE OR REPLACE FUNCTION public.qa_etapa_documento(tipo text)
RETURNS smallint
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE public.qa_categoria_documento(tipo)
    WHEN 'endereco'              THEN 1::smallint
    WHEN 'condicao_profissional' THEN 2::smallint
    WHEN 'antecedentes'          THEN 3::smallint
    WHEN 'declaracoes'           THEN 4::smallint
    WHEN 'exames'                THEN 5::smallint
    ELSE 1::smallint
  END;
$$;

-- 3) Recalcula prazos para refletir nova ordem
SELECT public.qa_recalcular_prazos_processo(id) FROM public.qa_processos;