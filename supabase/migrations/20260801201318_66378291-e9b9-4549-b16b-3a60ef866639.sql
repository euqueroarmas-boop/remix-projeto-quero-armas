UPDATE public.qa_documentos_cliente
   SET nome_documento = 'COMPROVANTE DE INSCRIÇÃO E DE SITUAÇÃO CADASTRAL DO CNPJ'
 WHERE tipo_documento IN ('renda_cartao_cnpj','cartao_cnpj');

UPDATE public.qa_processo_documentos
   SET nome_documento = 'COMPROVANTE DE INSCRIÇÃO E DE SITUAÇÃO CADASTRAL DO CNPJ'
 WHERE tipo_documento IN ('renda_cartao_cnpj','cartao_cnpj');