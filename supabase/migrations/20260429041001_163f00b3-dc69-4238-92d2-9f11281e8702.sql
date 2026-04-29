ALTER TABLE public.qa_cliente_armas_auditoria DISABLE TRIGGER qa_cliente_armas_audit_block_mut;
DELETE FROM public.qa_cliente_armas_auditoria WHERE qa_cliente_id IN (99, 100);
ALTER TABLE public.qa_cliente_armas_auditoria ENABLE TRIGGER qa_cliente_armas_audit_block_mut;

ALTER TABLE public.qa_cliente_armas_manual DISABLE TRIGGER qa_cliente_armas_manual_audit;
DELETE FROM public.qa_cliente_armas_manual WHERE qa_cliente_id IN (99, 100);
ALTER TABLE public.qa_cliente_armas_manual ENABLE TRIGGER qa_cliente_armas_manual_audit;

DELETE FROM public.cliente_auth_links WHERE qa_cliente_id IN (99, 100);
DELETE FROM public.qa_usuarios_perfis WHERE email = 'fase61.equipe@queroarmas.test';
DELETE FROM public.qa_clientes WHERE id IN (99, 100);