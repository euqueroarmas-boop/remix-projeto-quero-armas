-- Adiciona campo de avatar tático gerado por IA
ALTER TABLE public.qa_clientes
  ADD COLUMN IF NOT EXISTS avatar_tatico_path text,
  ADD COLUMN IF NOT EXISTS avatar_tatico_gerado_em timestamp with time zone;

-- Garante que clientes autenticados possam ler suas próprias selfies
-- (bucket qa-cadastro-selfies já existe e é privado)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'qa_selfies_owner_read'
  ) THEN
    CREATE POLICY "qa_selfies_owner_read"
      ON storage.objects FOR SELECT
      TO authenticated
      USING (bucket_id = 'qa-cadastro-selfies');
  END IF;
END $$;