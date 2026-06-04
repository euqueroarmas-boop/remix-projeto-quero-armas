
-- Staff/admin do Quero Armas precisa CRUD total em qa_documentos_cliente para
-- gerenciar documentos do Arsenal a partir do painel admin.
DROP POLICY IF EXISTS qa_docs_cliente_staff_select ON public.qa_documentos_cliente;
CREATE POLICY qa_docs_cliente_staff_select
  ON public.qa_documentos_cliente FOR SELECT TO authenticated
  USING (public.qa_is_active_staff(auth.uid()));

DROP POLICY IF EXISTS qa_docs_cliente_staff_insert ON public.qa_documentos_cliente;
CREATE POLICY qa_docs_cliente_staff_insert
  ON public.qa_documentos_cliente FOR INSERT TO authenticated
  WITH CHECK (public.qa_is_active_staff(auth.uid()));

DROP POLICY IF EXISTS qa_docs_cliente_staff_update ON public.qa_documentos_cliente;
CREATE POLICY qa_docs_cliente_staff_update
  ON public.qa_documentos_cliente FOR UPDATE TO authenticated
  USING (public.qa_is_active_staff(auth.uid()))
  WITH CHECK (public.qa_is_active_staff(auth.uid()));

DROP POLICY IF EXISTS qa_docs_cliente_staff_delete ON public.qa_documentos_cliente;
CREATE POLICY qa_docs_cliente_staff_delete
  ON public.qa_documentos_cliente FOR DELETE TO authenticated
  USING (public.qa_is_active_staff(auth.uid()));
