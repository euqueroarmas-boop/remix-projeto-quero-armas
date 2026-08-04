CREATE OR REPLACE FUNCTION public.qa_foto3x4_para_cadastro()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.tipo_documento = 'foto_3x4'
     AND NEW.status = 'aprovado'
     AND NEW.arquivo_storage_path IS NOT NULL
     AND NEW.qa_cliente_id IS NOT NULL THEN
    UPDATE public.qa_clientes
       SET imagem = NEW.arquivo_storage_path
     WHERE id = NEW.qa_cliente_id
       AND COALESCE(NULLIF(TRIM(imagem), ''), NULL) IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_qa_foto3x4_para_cadastro ON public.qa_documentos_cliente;
CREATE TRIGGER trg_qa_foto3x4_para_cadastro
AFTER INSERT OR UPDATE OF status, arquivo_storage_path ON public.qa_documentos_cliente
FOR EACH ROW EXECUTE FUNCTION public.qa_foto3x4_para_cadastro();

UPDATE public.qa_clientes c
   SET imagem = d.arquivo_storage_path
  FROM (
    SELECT DISTINCT ON (qa_cliente_id) qa_cliente_id, arquivo_storage_path
      FROM public.qa_documentos_cliente
     WHERE tipo_documento = 'foto_3x4'
       AND status = 'aprovado'
       AND arquivo_storage_path IS NOT NULL
     ORDER BY qa_cliente_id, created_at DESC
  ) d
 WHERE c.id = d.qa_cliente_id
   AND COALESCE(NULLIF(TRIM(c.imagem), ''), NULL) IS NULL;