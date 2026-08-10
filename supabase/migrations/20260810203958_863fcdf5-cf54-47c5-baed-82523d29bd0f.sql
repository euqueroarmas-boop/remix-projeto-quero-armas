-- 1) Storage: qa-cadastro-selfies
DROP POLICY IF EXISTS "Anon can read public-cadastro selfies" ON storage.objects;
DROP POLICY IF EXISTS "Anon can update public-cadastro selfies" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can update public-cadastro selfies" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can upload public-cadastro selfies" ON storage.objects;

-- 2) Base de conhecimento: somente equipe ativa
DROP POLICY IF EXISTS "qa_docs_auth_read" ON public.qa_documentos_conhecimento;
CREATE POLICY "qa_docs_staff_read" ON public.qa_documentos_conhecimento
FOR SELECT TO authenticated
USING (public.qa_is_active_staff(auth.uid()));

DROP POLICY IF EXISTS "qa_embeddings_auth_read" ON public.qa_embeddings;
CREATE POLICY "qa_embeddings_staff_read" ON public.qa_embeddings
FOR SELECT TO authenticated
USING (public.qa_is_active_staff(auth.uid()));