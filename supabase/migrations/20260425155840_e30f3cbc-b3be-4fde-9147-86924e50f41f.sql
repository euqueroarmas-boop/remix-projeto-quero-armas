-- Coluna de imagem específica por arma
ALTER TABLE public.qa_armamentos_catalogo
  ADD COLUMN IF NOT EXISTS imagem text,
  ADD COLUMN IF NOT EXISTS imagem_status text NOT NULL DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS imagem_gerada_em timestamptz;

-- Bucket público de imagens das armas
INSERT INTO storage.buckets (id, name, public)
VALUES ('qa-armamentos', 'qa-armamentos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Leitura pública
DROP POLICY IF EXISTS "qa-armamentos public read" ON storage.objects;
CREATE POLICY "qa-armamentos public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'qa-armamentos');

-- Apenas admin pode escrever
DROP POLICY IF EXISTS "qa-armamentos admin write" ON storage.objects;
CREATE POLICY "qa-armamentos admin write"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'qa-armamentos' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "qa-armamentos admin update" ON storage.objects;
CREATE POLICY "qa-armamentos admin update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'qa-armamentos' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "qa-armamentos admin delete" ON storage.objects;
CREATE POLICY "qa-armamentos admin delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'qa-armamentos' AND public.has_role(auth.uid(), 'admin'));