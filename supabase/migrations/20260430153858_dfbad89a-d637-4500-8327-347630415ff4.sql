-- Adiciona vínculo Solicitação -> Venda
ALTER TABLE public.qa_vendas
  ADD COLUMN IF NOT EXISTS solicitacao_id uuid NULL;

CREATE INDEX IF NOT EXISTS idx_qa_vendas_solicitacao_id
  ON public.qa_vendas (solicitacao_id);

-- FK opcional para integridade (ON DELETE SET NULL para não bloquear exclusões)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'qa_vendas_solicitacao_id_fkey'
  ) THEN
    ALTER TABLE public.qa_vendas
      ADD CONSTRAINT qa_vendas_solicitacao_id_fkey
      FOREIGN KEY (solicitacao_id)
      REFERENCES public.qa_solicitacoes_servico(id)
      ON DELETE SET NULL;
  END IF;
END$$;