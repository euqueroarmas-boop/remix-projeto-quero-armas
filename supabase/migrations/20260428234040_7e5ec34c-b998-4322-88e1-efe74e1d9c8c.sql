-- 1) NOVAS COLUNAS DE APROVAÇÃO --------------------------------------------------
ALTER TABLE public.qa_documentos_cliente
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pendente_aprovacao',
  ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'admin',
  ADD COLUMN IF NOT EXISTS aprovado_por uuid,
  ADD COLUMN IF NOT EXISTS aprovado_em timestamptz,
  ADD COLUMN IF NOT EXISTS reprovado_por uuid,
  ADD COLUMN IF NOT EXISTS reprovado_em timestamptz,
  ADD COLUMN IF NOT EXISTS motivo_reprovacao text;

-- 2) CONSTRAINTS DE DOMÍNIO ------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'qa_documentos_cliente_status_chk'
  ) THEN
    ALTER TABLE public.qa_documentos_cliente
      ADD CONSTRAINT qa_documentos_cliente_status_chk
      CHECK (status IN ('pendente_aprovacao','aprovado','reprovado','substituido','excluido'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'qa_documentos_cliente_origem_chk'
  ) THEN
    ALTER TABLE public.qa_documentos_cliente
      ADD CONSTRAINT qa_documentos_cliente_origem_chk
      CHECK (origem IN ('admin','cliente','sistema','scanner','importacao'));
  END IF;
END$$;

-- 3) BACKFILL: docs já validados pelo admin = aprovados; resto = pendente -------
UPDATE public.qa_documentos_cliente
   SET status      = 'aprovado',
       origem      = 'admin',
       aprovado_em = COALESCE(validado_em, updated_at, created_at)
 WHERE validado_admin = true
   AND status = 'pendente_aprovacao';

UPDATE public.qa_documentos_cliente
   SET status = 'aprovado',
       origem = 'admin',
       aprovado_em = COALESCE(updated_at, created_at)
 WHERE validado_admin = false
   AND status = 'pendente_aprovacao'
   AND created_at < now() - interval '1 day'; -- legado: não bloquear nada

-- 4) ÍNDICES ---------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_qa_docs_cliente_status
  ON public.qa_documentos_cliente (qa_cliente_id, status);
CREATE INDEX IF NOT EXISTS idx_qa_docs_customer_status
  ON public.qa_documentos_cliente (customer_id, status);
CREATE INDEX IF NOT EXISTS idx_qa_docs_pendentes
  ON public.qa_documentos_cliente (status) WHERE status = 'pendente_aprovacao';

-- 5) RLS: bloqueio explícito para cliente forçar status/origem/aprovação --------
DROP POLICY IF EXISTS client_insert_own_docs ON public.qa_documentos_cliente;
DROP POLICY IF EXISTS client_update_own_docs ON public.qa_documentos_cliente;

-- INSERT do cliente: só pode marcar como pendente + origem cliente, e nunca como aprovado/reprovado
CREATE POLICY client_insert_own_docs
  ON public.qa_documentos_cliente
  FOR INSERT
  TO authenticated
  WITH CHECK (
    qa_cliente_id IS NOT NULL
    AND qa_cliente_id = public.qa_current_cliente_id(auth.uid())
    AND status = 'pendente_aprovacao'
    AND origem = 'cliente'
    AND aprovado_por IS NULL
    AND reprovado_por IS NULL
    AND validado_admin = false
  );

-- UPDATE do cliente: só em docs próprios e só se ainda pendente/reprovado (reenvio)
-- Cliente NÃO pode mudar status para aprovado nem mexer em campos de aprovação
CREATE POLICY client_update_own_docs
  ON public.qa_documentos_cliente
  FOR UPDATE
  TO authenticated
  USING (
    qa_cliente_id IS NOT NULL
    AND qa_cliente_id = public.qa_current_cliente_id(auth.uid())
    AND status IN ('pendente_aprovacao','reprovado')
  )
  WITH CHECK (
    qa_cliente_id = public.qa_current_cliente_id(auth.uid())
    AND status IN ('pendente_aprovacao')
    AND validado_admin = false
    AND aprovado_por IS NULL
  );

-- 6) REALTIME: liga publication ---------------------------------------------------
ALTER TABLE public.qa_documentos_cliente REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'qa_documentos_cliente'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.qa_documentos_cliente;
  END IF;
END$$;

-- 7) TRIGGER: garante coerência ao aprovar/reprovar (staff) ---------------------
CREATE OR REPLACE FUNCTION public.qa_docs_cliente_status_coherence()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'aprovado' THEN
      NEW.aprovado_por := COALESCE(NEW.aprovado_por, auth.uid());
      NEW.aprovado_em  := COALESCE(NEW.aprovado_em, now());
      NEW.validado_admin := true;
      NEW.reprovado_por := NULL;
      NEW.reprovado_em  := NULL;
      NEW.motivo_reprovacao := NULL;
    ELSIF NEW.status = 'reprovado' THEN
      NEW.reprovado_por := COALESCE(NEW.reprovado_por, auth.uid());
      NEW.reprovado_em  := COALESCE(NEW.reprovado_em, now());
      NEW.validado_admin := false;
      NEW.aprovado_por := NULL;
      NEW.aprovado_em  := NULL;
    ELSIF NEW.status = 'pendente_aprovacao' THEN
      NEW.validado_admin := false;
      NEW.aprovado_por := NULL;
      NEW.aprovado_em  := NULL;
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END$$;

DROP TRIGGER IF EXISTS trg_qa_docs_cliente_status_coherence ON public.qa_documentos_cliente;
CREATE TRIGGER trg_qa_docs_cliente_status_coherence
  BEFORE UPDATE ON public.qa_documentos_cliente
  FOR EACH ROW EXECUTE FUNCTION public.qa_docs_cliente_status_coherence();