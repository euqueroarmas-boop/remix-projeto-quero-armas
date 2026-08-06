INSERT INTO public.qa_tipo_documento_aliases (processo_tipo, hub_tipo) VALUES
  ('certidao_federal_trf_3_regiao_abrangencia_da_secao_judiciari', 'antecedentes_federal_sjsp_jef'),
  ('certidao_federal_trf_3_regiao_abrangencia_da_secao_judiciari', 'antecedentes_federal_secao_judiciaria_sp'),
  ('certidao_federal_trf3_sjsp_jef', 'antecedentes_federal_secao_judiciaria_sp')
ON CONFLICT DO NOTHING;

SELECT public.qa_reaproveitar_documentos_hub_processo(p.id, 'fix_alias_sjsp_jef')
  FROM public.qa_processos p
 WHERE p.id IN (
   SELECT DISTINCT processo_id FROM public.qa_processo_documentos
    WHERE tipo_documento = 'certidao_federal_trf_3_regiao_abrangencia_da_secao_judiciari'
      AND status IN ('pendente','rejeitado')
 );