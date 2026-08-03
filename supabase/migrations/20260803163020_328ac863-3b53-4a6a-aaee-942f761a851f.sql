UPDATE public.qa_documentos_biblioteca
SET ativo = false
WHERE codigo IN ('antecedentes_federal','antecedentes_estadual');

WITH mapa(tipo_doc, lib_cod) AS (
  VALUES
    ('certidao_federal_trf3_regional','antecedentes_federal_trf3_regional'),
    ('certidao_tjsp_distribuicao_criminal','certidao_estadual_distribuicao_acoes_criminais'),
    ('certidao_tjsp_execucoes_criminais','certidao_estadual_execucoes_criminais'),
    ('certidao_antecedentes_policia_civil_sp','certidao_estadual_segundo_grau_acoes_criminais'),
    ('certidao_estadual_policia_civil','certidao_estadual_segundo_grau_acoes_criminais'),
    ('certidao_crimes_eleitorais_tse','certidao_antecedentes_criminais_eleitoral')
)
UPDATE public.qa_servicos_documentos sd
SET biblioteca_id = b.id, updated_at = now()
FROM mapa m
JOIN public.qa_documentos_biblioteca b ON b.codigo = m.lib_cod
WHERE sd.tipo_documento = m.tipo_doc
  AND sd.biblioteca_id IS NULL;