
-- Permitir anon fazer upsert (update + select próprio) na pasta cadastro-publico
CREATE POLICY "Anon can update public-cadastro selfies"
ON storage.objects FOR UPDATE
TO anon
USING (bucket_id = 'qa-cadastro-selfies' AND (storage.foldername(name))[1] = 'cadastro-publico')
WITH CHECK (bucket_id = 'qa-cadastro-selfies' AND (storage.foldername(name))[1] = 'cadastro-publico');

CREATE POLICY "Anon can read public-cadastro selfies"
ON storage.objects FOR SELECT
TO anon
USING (bucket_id = 'qa-cadastro-selfies' AND (storage.foldername(name))[1] = 'cadastro-publico');

-- Permitir anon (admin QA via token) fazer upload de fotos de clientes em qa-documentos/clientes/fotos
CREATE POLICY "Anon can upload client photos to qa-documentos"
ON storage.objects FOR INSERT
TO anon
WITH CHECK (bucket_id = 'qa-documentos' AND (storage.foldername(name))[1] = 'clientes');

CREATE POLICY "Anon can update client photos in qa-documentos"
ON storage.objects FOR UPDATE
TO anon
USING (bucket_id = 'qa-documentos' AND (storage.foldername(name))[1] = 'clientes')
WITH CHECK (bucket_id = 'qa-documentos' AND (storage.foldername(name))[1] = 'clientes');

CREATE POLICY "Anon can read client photos in qa-documentos"
ON storage.objects FOR SELECT
TO anon
USING (bucket_id = 'qa-documentos' AND (storage.foldername(name))[1] = 'clientes');
