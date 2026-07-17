
-- Permite staff ativo (qa_usuarios_perfis.ativo = true) escrever no bucket paid-contracts.
-- Necessário para fluxos assistidos (Piloto Real) onde a Equipe faz upload de
-- comprovantes de pagamento e evidências de negociação via browser.
-- Leitura continua restrita: SELECT existente ("Authenticated users can read own paid contracts")
-- + service_role bypass. Staff também recebe SELECT para inspecionar o que enviou.

DROP POLICY IF EXISTS "QA staff can upload to paid-contracts" ON storage.objects;
CREATE POLICY "QA staff can upload to paid-contracts"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'paid-contracts'
    AND public.qa_is_active_staff(auth.uid())
  );

DROP POLICY IF EXISTS "QA staff can update paid-contracts" ON storage.objects;
CREATE POLICY "QA staff can update paid-contracts"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'paid-contracts'
    AND public.qa_is_active_staff(auth.uid())
  )
  WITH CHECK (
    bucket_id = 'paid-contracts'
    AND public.qa_is_active_staff(auth.uid())
  );

DROP POLICY IF EXISTS "QA staff can read paid-contracts" ON storage.objects;
CREATE POLICY "QA staff can read paid-contracts"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'paid-contracts'
    AND public.qa_is_active_staff(auth.uid())
  );
