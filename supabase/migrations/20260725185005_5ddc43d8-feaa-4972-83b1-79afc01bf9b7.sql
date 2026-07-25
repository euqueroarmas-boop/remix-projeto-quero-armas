UPDATE public.qa_servicos_documentos
SET link_emissao = 'https://www.tse.jus.br/servicos-eleitorais/autoatendimento-eleitoral#/'
WHERE tipo_documento = 'certidao_antecedentes_criminais_eleitoral'
  AND link_emissao IN ('https://www.tse.jus.br/', 'https://www.tse.jus.br');

UPDATE public.qa_servicos_documentos
SET link_emissao = 'https://www2.cjf.jus.br/certidao/certidaoNegativa.jsp'
WHERE tipo_documento = 'certidao_antecedentes_criminais_federal'
  AND link_emissao IN ('https://www.jf.jus.br/', 'https://www.jf.jus.br');

UPDATE public.qa_servicos_documentos
SET link_emissao = 'https://www.stm.jus.br/servicos-ao-cidadao/atendimentoaocidadao/certidao-negativa'
WHERE tipo_documento = 'certidao_antecedentes_criminais_militar'
  AND link_emissao IN ('https://www.stm.jus.br/', 'https://www.stm.jus.br');