ALTER TABLE public.qa_itens_venda DROP CONSTRAINT IF EXISTS fk_qa_itens_venda__venda;
ALTER TABLE public.qa_vendas DROP CONSTRAINT IF EXISTS fk_qa_vendas__cliente;

ALTER TABLE public.qa_vendas
  ADD CONSTRAINT fk_qa_vendas__cliente_legado
  FOREIGN KEY (cliente_id) REFERENCES public.qa_clientes(id_legado) ON DELETE SET NULL;

ALTER TABLE public.qa_itens_venda
  ADD CONSTRAINT fk_qa_itens_venda__venda_legado
  FOREIGN KEY (venda_id) REFERENCES public.qa_vendas(id_legado) ON DELETE SET NULL;