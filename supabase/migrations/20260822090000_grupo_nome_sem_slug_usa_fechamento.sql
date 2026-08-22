-- =============================================================================
-- qa_grupo_nome: slug vazio/nulo passa a usar o nome do dicionário.
--
-- Processo sem pendência aplicável (ex.: o serviço bloqueado por pré-requisito)
-- chega aqui com slug nulo. A versão anterior caía no atalho genérico e o card
-- mostrava "OUTROS"; agora cai em 'outros' e usa o nome decidido, FECHAMENTO.
-- Só rótulo — nenhuma conta muda.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.qa_grupo_nome(p_slug text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $function$
  SELECT CASE lower(btrim(COALESCE(NULLIF(btrim(p_slug), ''), 'outros')))
    WHEN 'exigencias_pf'           THEN 'Exigências da Polícia Federal'
    WHEN 'assinaturas'             THEN 'Contratos'
    WHEN 'perguntas'               THEN 'Cadastros'
    WHEN 'identificacao'           THEN 'Identificação civil'
    WHEN 'endereco'                THEN 'Identificação residencial'
    WHEN 'ocupacao'                THEN 'Ocupação lícita'
    WHEN 'antecedentes'            THEN 'Idoneidade'
    WHEN 'antecedentes_anteriores' THEN 'Idoneidade — estados onde você morou antes'
    WHEN 'habitualidade'           THEN 'Habitualidade e clube'
    WHEN 'arma'                    THEN 'Documentos da arma'
    WHEN 'declaracoes'             THEN 'Declarações do processo'
    WHEN 'efetiva_necessidade'     THEN 'Efetiva necessidade'
    WHEN 'saude'                   THEN 'Laudos'
    WHEN 'laudos'                  THEN 'Laudos'
    WHEN 'requerimento'            THEN 'Requerimento'
    WHEN 'outros'                  THEN 'Fechamento'
    ELSE initcap(replace(btrim(p_slug), '_', ' '))
  END;
$function$;
