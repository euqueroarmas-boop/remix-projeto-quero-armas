ALTER TABLE public.qa_cliente_armas_auditoria DISABLE TRIGGER qa_cliente_armas_audit_block_mut;
DELETE FROM public.qa_cliente_armas_auditoria WHERE arma_manual_id = 15;
ALTER TABLE public.qa_cliente_armas_auditoria ENABLE TRIGGER qa_cliente_armas_audit_block_mut;

ALTER TABLE public.qa_cliente_armas_manual DISABLE TRIGGER qa_cliente_armas_manual_audit;
DELETE FROM public.qa_cliente_armas_manual WHERE id = 15 AND marca = 'TESTE F7';
ALTER TABLE public.qa_cliente_armas_manual ENABLE TRIGGER qa_cliente_armas_manual_audit;