DROP POLICY IF EXISTS client_insert_own_docs ON public.qa_documentos_cliente;
DROP POLICY IF EXISTS "client_insert_own_docs" ON public.qa_documentos_cliente;

CREATE POLICY client_insert_own_docs
  ON public.qa_documentos_cliente
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (
      qa_cliente_id IS NOT NULL
      AND qa_cliente_id = public.qa_current_cliente_id(auth.uid())
    )
    OR (
      customer_id IS NOT NULL
      AND customer_id IN (
        SELECT id FROM public.customers WHERE user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "client_insert_own_docs_storage" ON storage.objects;

CREATE POLICY "client_insert_own_docs_storage"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'qa-documentos'
    AND (storage.foldername(name))[1] = 'cliente-docs'
    AND (
      (storage.foldername(name))[2] IN (
        SELECT id::text FROM public.customers WHERE user_id = auth.uid()
      )
      OR (storage.foldername(name))[2] = (
        'qa-' || (public.qa_current_cliente_id(auth.uid()))::text
      )
    )
  );

DROP POLICY IF EXISTS "client_select_own_docs_storage" ON storage.objects;

CREATE POLICY "client_select_own_docs_storage"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'qa-documentos'
    AND (storage.foldername(name))[1] = 'cliente-docs'
    AND (
      (storage.foldername(name))[2] IN (
        SELECT id::text FROM public.customers WHERE user_id = auth.uid()
      )
      OR (storage.foldername(name))[2] = (
        'qa-' || (public.qa_current_cliente_id(auth.uid()))::text
      )
    )
  );