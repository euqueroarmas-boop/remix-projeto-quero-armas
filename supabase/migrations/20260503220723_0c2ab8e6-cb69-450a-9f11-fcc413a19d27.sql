-- Permite excluir clientes mesmo quando há trilha de auditoria de credenciais.
-- A FK anterior (ON DELETE SET NULL) tentava UPDATE no audit, bloqueado pelo
-- trigger de imutabilidade. Agora a trilha é removida em cascata junto com
-- a credencial, mantendo a integridade sem violar a regra de imutabilidade.
ALTER TABLE public.qa_cliente_credenciais_audit
  DROP CONSTRAINT IF EXISTS qa_cliente_credenciais_audit_credencial_id_fkey;

ALTER TABLE public.qa_cliente_credenciais_audit
  ADD CONSTRAINT qa_cliente_credenciais_audit_credencial_id_fkey
  FOREIGN KEY (credencial_id)
  REFERENCES public.qa_cliente_credenciais(id)
  ON DELETE CASCADE;

-- Permite que o trigger de imutabilidade aceite o DELETE em cascata vindo
-- da exclusão da credencial pai. Mantém o bloqueio para UPDATE direto.
CREATE OR REPLACE FUNCTION public.qa_cred_audit_imutavel()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'qa_cliente_credenciais_audit é imutável (acao=%).', TG_OP;
  END IF;
  -- DELETE só é permitido via cascade do FK (quando a credencial pai é removida)
  RETURN OLD;
END;
$$;