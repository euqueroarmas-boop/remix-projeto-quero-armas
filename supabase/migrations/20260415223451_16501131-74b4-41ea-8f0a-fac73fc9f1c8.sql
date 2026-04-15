-- Allow authenticated users to read files from qa-documentos bucket
CREATE POLICY "Authenticated users can read qa-documentos"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'qa-documentos');

-- Allow authenticated users to upload to qa-documentos bucket
CREATE POLICY "Authenticated users can upload to qa-documentos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'qa-documentos');

-- Allow authenticated users to update files in qa-documentos bucket
CREATE POLICY "Authenticated users can update qa-documentos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'qa-documentos');