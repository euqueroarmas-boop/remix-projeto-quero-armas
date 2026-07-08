DROP POLICY IF EXISTS qa_itens_venda_owner_select ON public.qa_itens_venda;
CREATE POLICY qa_itens_venda_owner_select
  ON public.qa_itens_venda
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.qa_vendas v
      WHERE COALESCE(v.id_legado, v.id) = qa_itens_venda.venda_id
        AND v.cliente_id = public.qa_current_cliente_id(auth.uid())
    )
  );