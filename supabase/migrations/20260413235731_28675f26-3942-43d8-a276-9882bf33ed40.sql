
CREATE POLICY "Anon can insert qa_logs_auditoria"
  ON public.qa_logs_auditoria FOR INSERT
  TO anon
  WITH CHECK (true);
