-- Permite que usuários anônimos façam upsert (update) e cleanup de seus próprios uploads no fluxo de cadastro público
CREATE POLICY "Anon can update public-cadastro selfies"
ON storage.objects
FOR UPDATE
TO anon
USING (bucket_id = 'qa-cadastro-selfies' AND (storage.foldername(name))[1] = 'cadastro-publico')
WITH CHECK (bucket_id = 'qa-cadastro-selfies' AND (storage.foldername(name))[1] = 'cadastro-publico');

CREATE POLICY "Anon can read public-cadastro selfies"
ON storage.objects
FOR SELECT
TO anon
USING (bucket_id = 'qa-cadastro-selfies' AND (storage.foldername(name))[1] = 'cadastro-publico');