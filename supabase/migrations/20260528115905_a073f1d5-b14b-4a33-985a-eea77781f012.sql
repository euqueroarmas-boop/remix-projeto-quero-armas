ALTER TABLE public.qa_servicos_catalogo
  ADD COLUMN IF NOT EXISTS exige_acervo BOOLEAN NULL;

COMMENT ON COLUMN public.qa_servicos_catalogo.exige_acervo IS
  'Trilha do serviço. true = exige acervo registrado (continuidade — renovação CRAF, transferência, GTE, etc.). false = serviço inicial sem pré-requisito de acervo (concessão CR inicial, filiação a clube, etc.). NULL = ambos / não classificado (padrão).';