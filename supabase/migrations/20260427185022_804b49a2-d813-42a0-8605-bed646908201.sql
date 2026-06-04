-- Resync sequences after legacy data imports that left them behind MAX(id)
SELECT setval('public.qa_vendas_id_seq', COALESCE((SELECT MAX(id) FROM public.qa_vendas), 0) + 1, false);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'qa_itens_venda_id_seq') THEN
    PERFORM setval('public.qa_itens_venda_id_seq', COALESCE((SELECT MAX(id) FROM public.qa_itens_venda), 0) + 1, false);
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'qa_clientes_id_seq') THEN
    PERFORM setval('public.qa_clientes_id_seq', COALESCE((SELECT MAX(id) FROM public.qa_clientes), 0) + 1, false);
  END IF;
END $$;