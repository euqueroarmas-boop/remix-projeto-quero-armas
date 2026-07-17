UPDATE public.qa_processo_documentos
   SET tipo_documento = 'rg_com_cpf'
 WHERE processo_id = '63a08830-f287-414c-9ae5-e102052a98d7'
   AND tipo_documento = 'documento';

SELECT public.qa_processo_rever_exigencias(189);