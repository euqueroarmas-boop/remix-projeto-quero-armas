ALTER TABLE public.qa_documentos_biblioteca DROP CONSTRAINT IF EXISTS chk_qa_bib_categoria;
ALTER TABLE public.qa_documentos_biblioteca ADD CONSTRAINT chk_qa_bib_categoria CHECK (categoria IN (
 'identificacao','residencia','ocupacao_licita','certidoes','laudos','arma_acervo','declaracoes',
 'efetiva_necessidade','cac_atividade','documentos_processo','juridico','outros'));

UPDATE public.qa_documentos_biblioteca SET categoria = 'ocupacao_licita'
WHERE categoria = 'outros' AND nome IN (
 'Cartão CNPJ','Cartão CNPJ (autônomo / MEI)','Carteira de Trabalho (CTPS)','Carteira funcional',
 'Certificado da Condição de MEI (CCMEI)','Contrato Social','Extrato INSS','Holerite mais recente',
 'Holerite recente (servidor público)','Comprovante de benefício','Quadro de Sócios e Administradores (QSA)',
 'Nota fiscal recente');

UPDATE public.qa_documentos_biblioteca SET categoria = 'cac_atividade'
WHERE categoria = 'outros' AND nome IN (
 'Comprovante de clube / entidade','Comprovante de competição / atividade','Comprovante de habitualidade',
 'Declaração de compromisso de habitualidade');

UPDATE public.qa_documentos_biblioteca SET categoria = 'documentos_processo'
WHERE categoria = 'outros' AND nome IN (
 'Despacho / movimentação','Exigência administrativa','Indeferimento','Ofício','Protocolo do processo',
 'Documento complementar do caso','Comprovante de pagamento');

UPDATE public.qa_documentos_biblioteca SET categoria = 'juridico'
WHERE categoria = 'outros' AND nome IN (
 'Mandado de segurança / peça jurídica','Procuração','Recurso administrativo');

UPDATE public.qa_documentos_biblioteca SET categoria = 'efetiva_necessidade'
WHERE categoria = 'outros' AND nome IN ('Comprovação de efetiva necessidade');