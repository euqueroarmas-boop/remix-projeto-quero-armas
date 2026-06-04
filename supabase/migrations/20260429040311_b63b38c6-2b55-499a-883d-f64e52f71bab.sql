-- Limpa eventos de teste criados durante validação da trigger.
-- Como a tabela é imutável (trigger BEFORE UPDATE/DELETE bloqueia tudo),
-- desativamos temporariamente o gatilho para a faxina, depois restauramos.
ALTER TABLE public.qa_cliente_armas_auditoria DISABLE TRIGGER qa_cliente_armas_audit_block_mut;

DELETE FROM public.qa_cliente_armas_auditoria
 WHERE (dados_depois->>'marca') LIKE 'TESTE-F6%'
    OR (dados_antes ->>'marca') LIKE 'TESTE-F6%';

ALTER TABLE public.qa_cliente_armas_auditoria ENABLE TRIGGER qa_cliente_armas_audit_block_mut;