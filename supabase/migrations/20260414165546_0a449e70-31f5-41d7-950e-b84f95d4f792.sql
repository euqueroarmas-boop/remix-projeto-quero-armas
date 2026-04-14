-- Allow authenticated users to read qa_cadastro_publico
CREATE POLICY "Authenticated users can read qa_cadastro_publico"
ON public.qa_cadastro_publico
FOR SELECT
TO authenticated
USING (true);

-- Allow anon to insert (public form)
CREATE POLICY "Anon can insert qa_cadastro_publico"
ON public.qa_cadastro_publico
FOR INSERT
TO anon
WITH CHECK (true);

-- Allow authenticated to insert
CREATE POLICY "Authenticated can insert qa_cadastro_publico"
ON public.qa_cadastro_publico
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow authenticated to update
CREATE POLICY "Authenticated can update qa_cadastro_publico"
ON public.qa_cadastro_publico
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);