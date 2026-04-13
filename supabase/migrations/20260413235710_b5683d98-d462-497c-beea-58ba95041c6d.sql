
CREATE POLICY "Anon can select qa_documentos_conhecimento"
  ON public.qa_documentos_conhecimento FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anon can select qa_geracoes_pecas"
  ON public.qa_geracoes_pecas FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anon can insert qa_geracoes_pecas"
  ON public.qa_geracoes_pecas FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anon can insert qa_documentos_conhecimento"
  ON public.qa_documentos_conhecimento FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anon can update qa_documentos_conhecimento"
  ON public.qa_documentos_conhecimento FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);
