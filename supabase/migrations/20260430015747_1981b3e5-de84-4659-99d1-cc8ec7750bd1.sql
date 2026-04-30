-- Cleanup Fase 16-E: remove dados de teste sintéticos
ALTER TABLE public.qa_venda_eventos DISABLE TRIGGER USER;
DELETE FROM public.qa_venda_eventos WHERE venda_id IN (146,147);
ALTER TABLE public.qa_venda_eventos ENABLE TRIGGER USER;
DELETE FROM public.qa_itens_venda WHERE id IN (308,309);
DELETE FROM public.qa_vendas WHERE id IN (146,147);
DELETE FROM public.qa_clientes WHERE id = 104 AND origem = 'fluxo_publico_contratacao';