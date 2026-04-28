-- 1) BACKUP
CREATE TABLE IF NOT EXISTS public.qa_cadastro_cr_backup_p0 AS
SELECT *, now() AS backup_at FROM public.qa_cadastro_cr;

CREATE TABLE IF NOT EXISTS public.qa_incident_reconciliation_snapshot AS
SELECT *, now() AS snapshot_at FROM public.qa_incident_reconciliation_plan;

-- 2) LOG DE AUDITORIA
WITH ator AS (
  SELECT (SELECT user_id FROM public.qa_senha_gov_acessos
          WHERE acao='migrate' AND user_id IS NOT NULL
          ORDER BY created_at ASC LIMIT 1) AS uid
)
INSERT INTO public.qa_senha_gov_acessos (
  cadastro_cr_id, cliente_id, user_id, acao, contexto, created_at
)
SELECT
  p.cadastro_cr_id,
  p.cliente_correto_id,
  (SELECT uid FROM ator),
  'reconcile',
  'Reconciliacao P0 vinculo CR-cliente 26/04: anterior=' || p.cliente_atual_id::text
    || ' (' || COALESCE(p.cliente_atual_nome,'') || ') -> correto='
    || p.cliente_correto_id::text || ' (' || COALESCE(p.cliente_correto_nome,'') || ')',
  now()
FROM public.qa_incident_reconciliation_plan p
WHERE p.status_reconciliacao = 'a_reconciliar'
  AND p.cliente_correto_id IS NOT NULL;

-- 3) RECONCILIAÇÃO
UPDATE public.qa_cadastro_cr cr
SET cliente_id = p.cliente_correto_id
FROM public.qa_incident_reconciliation_plan p
WHERE cr.id = p.cadastro_cr_id
  AND p.status_reconciliacao = 'a_reconciliar'
  AND p.cliente_correto_id IS NOT NULL;

-- 4) HARDENING
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'qa_cadastro_cr_cliente_id_fkey'
      AND conrelid = 'public.qa_cadastro_cr'::regclass
  ) THEN
    ALTER TABLE public.qa_cadastro_cr
      ADD CONSTRAINT qa_cadastro_cr_cliente_id_fkey
      FOREIGN KEY (cliente_id) REFERENCES public.qa_clientes(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_qa_cadastro_cr_cliente_id ON public.qa_cadastro_cr(cliente_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_qa_cadastro_cr_cliente_numero
  ON public.qa_cadastro_cr(cliente_id, numero_cr)
  WHERE cliente_id IS NOT NULL AND numero_cr IS NOT NULL;

-- 5) AUDITORIA DE ALTERAÇÕES FUTURAS
CREATE TABLE IF NOT EXISTS public.qa_cadastro_cr_audit (
  id BIGSERIAL PRIMARY KEY,
  cadastro_cr_id INTEGER NOT NULL,
  cliente_id_anterior INTEGER,
  cliente_id_novo INTEGER,
  changed_by UUID,
  contexto TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.qa_cadastro_cr_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view CR audit" ON public.qa_cadastro_cr_audit;
CREATE POLICY "Staff can view CR audit" ON public.qa_cadastro_cr_audit
  FOR SELECT TO authenticated
  USING (public.qa_is_active_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.qa_cadastro_cr_audit_cliente_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.cliente_id IS DISTINCT FROM OLD.cliente_id THEN
    INSERT INTO public.qa_cadastro_cr_audit
      (cadastro_cr_id, cliente_id_anterior, cliente_id_novo, changed_by, contexto)
    VALUES (NEW.id, OLD.cliente_id, NEW.cliente_id, auth.uid(),
            'cliente_id alterado em qa_cadastro_cr');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_qa_cadastro_cr_audit_cliente ON public.qa_cadastro_cr;
CREATE TRIGGER trg_qa_cadastro_cr_audit_cliente
  AFTER UPDATE OF cliente_id ON public.qa_cadastro_cr
  FOR EACH ROW EXECUTE FUNCTION public.qa_cadastro_cr_audit_cliente_change();

CREATE OR REPLACE FUNCTION public.qa_cadastro_cr_audit_imutavel()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'qa_cadastro_cr_audit eh imutavel.';
END;
$$;

DROP TRIGGER IF EXISTS trg_qa_cadastro_cr_audit_protect ON public.qa_cadastro_cr_audit;
CREATE TRIGGER trg_qa_cadastro_cr_audit_protect
  BEFORE UPDATE OR DELETE ON public.qa_cadastro_cr_audit
  FOR EACH ROW EXECUTE FUNCTION public.qa_cadastro_cr_audit_imutavel();