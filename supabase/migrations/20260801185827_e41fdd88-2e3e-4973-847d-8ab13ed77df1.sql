UPDATE public.qa_processo_documentos
SET link_emissao = 'https://solucoes.receita.fazenda.gov.br/Servicos/cnpjreva/Cnpjreva_Solicitacao.asp'
WHERE link_emissao ILIKE '%cnpjreva%'
  AND link_emissao <> 'https://solucoes.receita.fazenda.gov.br/Servicos/cnpjreva/Cnpjreva_Solicitacao.asp';

UPDATE public.qa_servicos_documentos
SET link_emissao = 'https://solucoes.receita.fazenda.gov.br/Servicos/cnpjreva/Cnpjreva_Solicitacao.asp'
WHERE link_emissao ILIKE '%cnpjreva%'
  AND link_emissao <> 'https://solucoes.receita.fazenda.gov.br/Servicos/cnpjreva/Cnpjreva_Solicitacao.asp';

UPDATE public.qa_documentos_biblioteca
SET link_emissao = 'https://solucoes.receita.fazenda.gov.br/Servicos/cnpjreva/Cnpjreva_Solicitacao.asp'
WHERE link_emissao ILIKE '%cnpjreva%'
  AND link_emissao <> 'https://solucoes.receita.fazenda.gov.br/Servicos/cnpjreva/Cnpjreva_Solicitacao.asp';