UPDATE public.qa_servicos_documentos
SET link_emissao = 'https://www.jucesponline.sp.gov.br/'
WHERE tipo_documento = 'renda_contrato_social'
  AND link_emissao IS NULL;