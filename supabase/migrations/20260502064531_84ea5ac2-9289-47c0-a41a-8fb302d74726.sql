-- =========================================================================
-- Vincula declarações condicionais (responsável pelo imóvel + sem inquérito)
-- e perguntas-pivot da Etapa 1 à categoria 'endereco' (Etapa 1).
-- Demais declarações continuam na Etapa 4.
-- =========================================================================

CREATE OR REPLACE FUNCTION public.qa_categoria_documento(tipo text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN tipo IS NULL THEN 'outros'
    -- Endereço (comprovantes + perguntas e declarações auxiliares condicionais da Etapa 1)
    WHEN tipo LIKE 'comprovante_endereco%' THEN 'endereco'
    WHEN tipo IN (
      'pergunta_comprovante_em_nome',
      'pergunta_ainda_reside_imovel',
      'pergunta_responde_inquerito_criminal',
      'declaracao_responsavel_imovel',
      'declaracao_sem_inquerito_processo_criminal'
    ) THEN 'endereco'
    -- Renda / condição profissional
    WHEN tipo = 'renda_definir_condicao' THEN 'condicao_profissional'
    WHEN tipo LIKE 'renda_%' THEN 'condicao_profissional'
    WHEN tipo LIKE 'certidao%' OR tipo ILIKE '%antecedentes%' THEN 'antecedentes'
    WHEN tipo LIKE 'declaracao%' OR tipo ILIKE '%compromisso%' THEN 'declaracoes'
    WHEN tipo ILIKE '%laudo%' OR tipo ILIKE '%tiro%' OR tipo ILIKE '%aptidao%' OR tipo ILIKE '%psicologic%' OR tipo ILIKE '%capacidade_tecnica%' THEN 'exames'
    ELSE 'outros'
  END;
$function$;

-- Recalcula prazos / etapas para refletir o novo mapeamento
SELECT public.qa_recalcular_prazos_processo(id) FROM public.qa_processos
WHERE status NOT IN ('concluido','cancelado','excluido_lgpd');