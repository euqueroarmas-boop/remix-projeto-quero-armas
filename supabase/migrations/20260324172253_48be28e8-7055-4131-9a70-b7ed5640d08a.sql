CREATE POLICY "Anon can read budget_leads"
  ON public.budget_leads
  FOR SELECT
  TO anon
  USING (true);