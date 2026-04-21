
ALTER TABLE public.qa_cadastro_publico
  ADD COLUMN IF NOT EXISTS objetivo_principal text,
  ADD COLUMN IF NOT EXISTS categoria_servico text,
  ADD COLUMN IF NOT EXISTS servico_principal text,
  ADD COLUMN IF NOT EXISTS subtipo_servico text,
  ADD COLUMN IF NOT EXISTS descricao_servico_livre text,
  ADD COLUMN IF NOT EXISTS servico_fechado_final text,
  ADD COLUMN IF NOT EXISTS origem_cadastro text DEFAULT 'cadastro_publico';

CREATE INDEX IF NOT EXISTS idx_qa_cadpub_objetivo ON public.qa_cadastro_publico (objetivo_principal);
CREATE INDEX IF NOT EXISTS idx_qa_cadpub_categoria ON public.qa_cadastro_publico (categoria_servico);
CREATE INDEX IF NOT EXISTS idx_qa_cadpub_servico ON public.qa_cadastro_publico (servico_principal);
CREATE INDEX IF NOT EXISTS idx_qa_cadpub_subtipo ON public.qa_cadastro_publico (subtipo_servico);
CREATE INDEX IF NOT EXISTS idx_qa_cadpub_origem ON public.qa_cadastro_publico (origem_cadastro);
