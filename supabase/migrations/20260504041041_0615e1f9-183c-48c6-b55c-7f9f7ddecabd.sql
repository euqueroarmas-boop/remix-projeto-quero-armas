-- Anexos de movimentações de munições
CREATE POLICY "QA staff manage municoes attachments"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'qa-documentos'
  AND (storage.foldername(name))[1] = 'clientes'
  AND (storage.foldername(name))[3] = 'municoes'
  AND public.qa_is_active_staff(auth.uid())
)
WITH CHECK (
  bucket_id = 'qa-documentos'
  AND (storage.foldername(name))[1] = 'clientes'
  AND (storage.foldername(name))[3] = 'municoes'
  AND public.qa_is_active_staff(auth.uid())
);

CREATE POLICY "QA owner read municoes attachments"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'qa-documentos'
  AND (storage.foldername(name))[1] = 'clientes'
  AND (storage.foldername(name))[3] = 'municoes'
  AND (storage.foldername(name))[2] = public.qa_current_cliente_id(auth.uid())::text
);

CREATE POLICY "QA owner upload municoes attachments"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'qa-documentos'
  AND (storage.foldername(name))[1] = 'clientes'
  AND (storage.foldername(name))[3] = 'municoes'
  AND (storage.foldername(name))[2] = public.qa_current_cliente_id(auth.uid())::text
);