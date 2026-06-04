-- Phase 17-C: allow free Arsenal accounts (cliente_app) to use Document Hub
-- 1) Allow customer_id NULL on qa_documentos_cliente (free accounts have no customers row)
ALTER TABLE public.qa_documentos_cliente
  ALTER COLUMN customer_id DROP NOT NULL;

-- 2) Extend client SELECT policy to include qa_cliente_id ownership (so free clients see their docs)
DROP POLICY IF EXISTS client_select_own_docs ON public.qa_documentos_cliente;
CREATE POLICY client_select_own_docs
ON public.qa_documentos_cliente
FOR SELECT
USING (
  (qa_cliente_id IS NOT NULL AND qa_cliente_id = qa_current_cliente_id(auth.uid()))
  OR (
    customer_id IS NOT NULL
    AND customer_id IN (SELECT customers.id FROM customers WHERE customers.user_id = auth.uid())
  )
);

-- 3) Extend client DELETE policy similarly (only own pending docs)
DROP POLICY IF EXISTS client_delete_own_docs ON public.qa_documentos_cliente;
CREATE POLICY client_delete_own_docs
ON public.qa_documentos_cliente
FOR DELETE
USING (
  (qa_cliente_id IS NOT NULL AND qa_cliente_id = qa_current_cliente_id(auth.uid()))
  OR (
    customer_id IS NOT NULL
    AND customer_id IN (SELECT customers.id FROM customers WHERE customers.user_id = auth.uid())
  )
);