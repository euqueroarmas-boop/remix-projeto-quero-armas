-- As políticas de INSERT em qa_documentos_cliente e storage.objects foram
-- criadas em 2026-04-23 com suporte apenas a customer_id.
-- Em 2026-04-30 somente SELECT e DELETE foram atualizados para incluir
-- qa_cliente_id. INSERT ficou para trás → qualquer cliente sem customer_id
-- (ou com qa_cliente_id apenas) esbarrava em RLS ao salvar um documento.
--
-- Esta migration corrige o INSERT em ambas as tabelas.

-- ─── 1. qa_documentos_cliente ─────────────────────────────────────────────────

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

-- ─── 2. storage.objects (bucket qa-documentos, pasta cliente-docs) ────────────
-- Também suporta o prefixo "qa-{id}" usado por clientes sem customer_id.

DROP POLICY IF EXISTS "client_insert_own_docs_storage" ON storage.objects;

CREATE POLICY "client_insert_own_docs_storage"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'qa-documentos'
    AND (storage.foldername(name))[1] = 'cliente-docs'
    AND (
      -- cliente com customers row: pasta = customers.id
      (storage.foldername(name))[2] IN (
        SELECT id::text FROM public.customers WHERE user_id = auth.uid()
      )
      -- cliente sem customers row: pasta = "qa-{qa_cliente_id}"
      OR (storage.foldername(name))[2] = (
        'qa-' || (public.qa_current_cliente_id(auth.uid()))::text
      )
    )
  );

-- Mesmo ajuste para SELECT no storage (garante consistência de leitura)
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
