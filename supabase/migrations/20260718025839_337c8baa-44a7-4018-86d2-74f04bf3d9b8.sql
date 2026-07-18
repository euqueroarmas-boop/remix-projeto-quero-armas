REVOKE ALL ON FUNCTION public.qa_reaproveitar_documentos_hub_processo(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.qa_reaproveitar_documentos_hub_processo(uuid, text) TO service_role;

REVOKE ALL ON FUNCTION public.qa_doc_hub_satisfaz_exigencias_processo() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.qa_doc_hub_satisfaz_exigencias_processo() TO service_role;