-- Corrige leitura da procuração no portal do cliente.
-- O legado pode gravar qa_procuracoes.cliente_id como qa_clientes.id ou como id_legado.

DROP POLICY IF EXISTS qa_procuracoes_cliente_read ON public.qa_procuracoes;
CREATE POLICY qa_procuracoes_cliente_read ON public.qa_procuracoes
  FOR SELECT USING (
    cliente_id IN (
      SELECT qc.id
      FROM public.qa_clientes qc
      WHERE qc.user_id = auth.uid()
         OR qc.customer_id IN (
          SELECT c.id FROM public.customers c WHERE c.user_id = auth.uid()
        )
    )
    OR cliente_id IN (
      SELECT qc.id_legado
      FROM public.qa_clientes qc
      WHERE qc.id_legado IS NOT NULL
        AND (
          qc.user_id = auth.uid()
          OR qc.customer_id IN (
            SELECT c.id FROM public.customers c WHERE c.user_id = auth.uid()
          )
        )
    )
  );
