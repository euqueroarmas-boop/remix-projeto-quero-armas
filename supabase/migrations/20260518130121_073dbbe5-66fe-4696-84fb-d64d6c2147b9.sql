-- Mirror anon insert/update policies for authenticated users on the same public-cadastro prefix.
-- Fixes RLS error when logged-in clients upload personal documents (identity / address proof / selfie)
-- via Etapa02Documentos in /cadastro Mira. Does NOT change anon policies, does NOT touch other buckets,
-- does NOT touch qa_documentos_cliente, checkout, contracts, WMTi or Arsenal.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects'
      AND policyname='Authenticated can upload public-cadastro selfies'
  ) THEN
    CREATE POLICY "Authenticated can upload public-cadastro selfies"
      ON storage.objects
      FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id = 'qa-cadastro-selfies'
        AND (storage.foldername(name))[1] = 'cadastro-publico'
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects'
      AND policyname='Authenticated can update public-cadastro selfies'
  ) THEN
    CREATE POLICY "Authenticated can update public-cadastro selfies"
      ON storage.objects
      FOR UPDATE
      TO authenticated
      USING (
        bucket_id = 'qa-cadastro-selfies'
        AND (storage.foldername(name))[1] = 'cadastro-publico'
      )
      WITH CHECK (
        bucket_id = 'qa-cadastro-selfies'
        AND (storage.foldername(name))[1] = 'cadastro-publico'
      );
  END IF;
END $$;