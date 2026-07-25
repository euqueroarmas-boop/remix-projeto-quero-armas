
-- Remove 3 exigências desnecessárias de antecedentes do cliente 211 (piloto)
-- e reordena as demais na sequência: União (TSE) → TRF Regional (Federal) → Estaduais (PC, TJSP dist, TJSP exec).
DELETE FROM public.qa_processo_documentos
WHERE processo_id IN (SELECT id FROM public.qa_processos WHERE cliente_id = 211)
  AND tipo_documento IN (
    'certidao_estadual_segundo_grau_acoes_criminais',
    'certidao_estadual_segundo_grau_execucoes_criminais',
    'certidao_antecedentes_criminais_militar'
  );

-- Aplica ordem intra-grupo antecedentes conforme regra: União → TRF → Estaduais.
UPDATE public.qa_processo_documentos SET ordem = 3050
  WHERE processo_id IN (SELECT id FROM public.qa_processos WHERE cliente_id = 211)
    AND tipo_documento = 'certidao_antecedentes_criminais_eleitoral';
UPDATE public.qa_processo_documentos SET ordem = 3060
  WHERE processo_id IN (SELECT id FROM public.qa_processos WHERE cliente_id = 211)
    AND tipo_documento = 'certidao_antecedentes_criminais_federal';
UPDATE public.qa_processo_documentos SET ordem = 3070
  WHERE processo_id IN (SELECT id FROM public.qa_processos WHERE cliente_id = 211)
    AND tipo_documento = 'certidao_antecedentes_criminais_estadual';
UPDATE public.qa_processo_documentos SET ordem = 3080
  WHERE processo_id IN (SELECT id FROM public.qa_processos WHERE cliente_id = 211)
    AND tipo_documento = 'certidao_estadual_distribuicao_acoes_criminais';
UPDATE public.qa_processo_documentos SET ordem = 3090
  WHERE processo_id IN (SELECT id FROM public.qa_processos WHERE cliente_id = 211)
    AND tipo_documento = 'certidao_estadual_execucoes_criminais';

-- Regra global: retira das listas de checklist futuras os 3 códigos.
-- (Catálogo atual em qa_servicos_documentos já não inclui os 2 "segundo_grau"; remove o TJM-SP / militar para novos processos civis.)
DELETE FROM public.qa_servicos_documentos
WHERE tipo_documento IN (
  'certidao_estadual_segundo_grau_acoes_criminais',
  'certidao_estadual_segundo_grau_execucoes_criminais',
  'certidao_criminal_tjmsp',
  'certidao_crimes_militares_stm'
);

-- Reordena o catálogo remanescente: União (TSE) → TRF Regional → TJSP dist → TJSP exec → PC estadual.
UPDATE public.qa_servicos_documentos SET ordem = 30 WHERE tipo_documento = 'certidao_crimes_eleitorais_tse';
UPDATE public.qa_servicos_documentos SET ordem = 32 WHERE tipo_documento = 'certidao_federal_trf3_regional';
UPDATE public.qa_servicos_documentos SET ordem = 33 WHERE tipo_documento = 'certidao_federal_trf3_sjsp_jef';
UPDATE public.qa_servicos_documentos SET ordem = 34 WHERE tipo_documento = 'certidao_antecedentes_policia_civil_sp';
UPDATE public.qa_servicos_documentos SET ordem = 35 WHERE tipo_documento = 'certidao_tjsp_distribuicao_criminal';
UPDATE public.qa_servicos_documentos SET ordem = 36 WHERE tipo_documento = 'certidao_tjsp_execucoes_criminais';
