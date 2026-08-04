GRANT SELECT ON public.qa_documento_downloads TO authenticated;
DROP POLICY IF EXISTS qa_documento_downloads_staff_select ON public.qa_documento_downloads;
CREATE POLICY qa_documento_downloads_staff_select
  ON public.qa_documento_downloads
  FOR SELECT TO authenticated
  USING (public.qa_is_active_staff(auth.uid()));