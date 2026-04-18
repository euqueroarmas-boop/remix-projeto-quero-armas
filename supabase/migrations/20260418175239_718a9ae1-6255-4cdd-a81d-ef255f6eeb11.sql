-- 1. Add selfie_path column to qa_cadastro_publico
ALTER TABLE public.qa_cadastro_publico
  ADD COLUMN IF NOT EXISTS selfie_path text;

-- 2. Create dedicated storage bucket for public-form selfies (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('qa-cadastro-selfies', 'qa-cadastro-selfies', false)
ON CONFLICT (id) DO NOTHING;

-- 3. RLS policies on storage.objects for the new bucket
-- Allow anonymous (public form) to upload only into the 'cadastro-publico/' prefix
CREATE POLICY "Anon can upload public-cadastro selfies"
ON storage.objects FOR INSERT
TO anon
WITH CHECK (
  bucket_id = 'qa-cadastro-selfies'
  AND (storage.foldername(name))[1] = 'cadastro-publico'
);

-- Allow authenticated users (admins) to read selfies
CREATE POLICY "Authenticated can read cadastro selfies"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'qa-cadastro-selfies');

-- Allow authenticated users to delete selfies (cleanup/LGPD)
CREATE POLICY "Authenticated can delete cadastro selfies"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'qa-cadastro-selfies');