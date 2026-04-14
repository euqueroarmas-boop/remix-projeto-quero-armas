
-- Allow UPDATE and DELETE on qa_ CRUD tables for anon
CREATE POLICY "anon_update_qa_clientes" ON public.qa_clientes FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_qa_clientes" ON public.qa_clientes FOR DELETE TO anon USING (true);

CREATE POLICY "anon_update_qa_crafs" ON public.qa_crafs FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_qa_crafs" ON public.qa_crafs FOR DELETE TO anon USING (true);

CREATE POLICY "anon_update_qa_gtes" ON public.qa_gtes FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_qa_gtes" ON public.qa_gtes FOR DELETE TO anon USING (true);

CREATE POLICY "anon_update_qa_cadastro_cr" ON public.qa_cadastro_cr FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_qa_cadastro_cr" ON public.qa_cadastro_cr FOR DELETE TO anon USING (true);

CREATE POLICY "anon_update_qa_vendas" ON public.qa_vendas FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_qa_vendas" ON public.qa_vendas FOR DELETE TO anon USING (true);

CREATE POLICY "anon_update_qa_itens_venda" ON public.qa_itens_venda FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_qa_itens_venda" ON public.qa_itens_venda FOR DELETE TO anon USING (true);

CREATE POLICY "anon_update_qa_filiacoes" ON public.qa_filiacoes FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_qa_filiacoes" ON public.qa_filiacoes FOR DELETE TO anon USING (true);
