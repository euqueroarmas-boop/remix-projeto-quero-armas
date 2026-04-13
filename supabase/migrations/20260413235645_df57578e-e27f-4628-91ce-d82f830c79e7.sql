
-- Add anon policies for qa_casos so cases can be saved and viewed without authentication
CREATE POLICY "Anon can insert qa_casos"
  ON public.qa_casos FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anon can select qa_casos"
  ON public.qa_casos FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anon can update qa_casos"
  ON public.qa_casos FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);
