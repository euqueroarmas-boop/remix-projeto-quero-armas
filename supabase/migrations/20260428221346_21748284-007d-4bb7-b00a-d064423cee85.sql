ALTER TABLE public.qa_cadastro_cr_backup_p0 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qa_incident_reconciliation_snapshot ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view CR backup p0" ON public.qa_cadastro_cr_backup_p0;
CREATE POLICY "Staff can view CR backup p0" ON public.qa_cadastro_cr_backup_p0
  FOR SELECT TO authenticated
  USING (public.qa_is_active_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff can view reconciliation snapshot" ON public.qa_incident_reconciliation_snapshot;
CREATE POLICY "Staff can view reconciliation snapshot" ON public.qa_incident_reconciliation_snapshot
  FOR SELECT TO authenticated
  USING (public.qa_is_active_staff(auth.uid()));