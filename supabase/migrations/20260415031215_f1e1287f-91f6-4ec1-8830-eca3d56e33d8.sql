-- Fix storage upload policy to allow ALL authenticated users
DROP POLICY IF EXISTS "qa_storage_auth_upload" ON storage.objects;
CREATE POLICY "qa_storage_auth_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id IN ('qa-documentos', 'qa-templates', 'qa-geracoes')
  );

-- Fix storage read policy to allow ALL authenticated users
DROP POLICY IF EXISTS "qa_storage_auth_read" ON storage.objects;
CREATE POLICY "qa_storage_auth_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id IN ('qa-documentos', 'qa-templates', 'qa-geracoes')
  );

-- Fix qa_documentos_conhecimento insert policy for all authenticated users
DROP POLICY IF EXISTS "qa_docs_auth_insert" ON qa_documentos_conhecimento;
CREATE POLICY "qa_docs_auth_insert" ON qa_documentos_conhecimento
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Fix qa_documentos_conhecimento read policy for all authenticated users
DROP POLICY IF EXISTS "qa_docs_auth_read" ON qa_documentos_conhecimento;
CREATE POLICY "qa_docs_auth_read" ON qa_documentos_conhecimento
  FOR SELECT TO authenticated
  USING (true);

-- Fix qa_documentos_conhecimento update policy for all authenticated users
DROP POLICY IF EXISTS "qa_docs_auth_update" ON qa_documentos_conhecimento;
CREATE POLICY "qa_docs_auth_update" ON qa_documentos_conhecimento
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);