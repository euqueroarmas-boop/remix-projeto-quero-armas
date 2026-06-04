-- Trava o valor cobrado no momento da contratação, sem gerar cobrança automática.
ALTER TABLE public.qa_cadastro_publico
  ADD COLUMN IF NOT EXISTS valor_servico numeric(12,2);

COMMENT ON COLUMN public.qa_cadastro_publico.valor_servico IS
  'Valor congelado do serviço no momento da contratação (snapshot de qa_servicos_catalogo.preco). Não dispara cobrança automática — equipe Quero Armas processa no financeiro.';

CREATE INDEX IF NOT EXISTS idx_qa_cadastro_publico_valor_servico
  ON public.qa_cadastro_publico(valor_servico)
  WHERE valor_servico IS NOT NULL;