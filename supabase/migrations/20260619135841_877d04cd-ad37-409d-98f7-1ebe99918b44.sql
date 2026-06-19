
ALTER TABLE public.qa_servicos_catalogo
  ADD COLUMN IF NOT EXISTS exige_cr BOOLEAN NULL;

COMMENT ON COLUMN public.qa_servicos_catalogo.exige_cr IS
  'true = requer CR ativo do CAC pré-existente. false = não requer CR preexistente. NULL = não classificado.';

UPDATE public.qa_servicos_catalogo
SET exige_acervo = true
WHERE slug IN (
  'apostilamento-atualizacao','craf-sigma','gte','guia-de-trafego-especial-cac',
  'registro-e-apostilamento-de-arma-de-fogo-cac','renovacao-posse-de-arma-de-fogo',
  'renovacao-porte','renovacao-de-porte-de-arma-de-fogo','registro-arma-fogo',
  'registro-de-arma-de-fogo','mudanca-servico'
);

UPDATE public.qa_servicos_catalogo
SET exige_acervo = false
WHERE slug IN (
  'concessao-cr','renovacao-cr','posse-arma-fogo','porte-arma-fogo','autorizacao-compra',
  'aquisicao-registro-posse-de-arma-de-fogo',
  'autorizacao-de-compra-de-arma-de-fogo-atirador-esportivo-cac',
  'autorizacao-de-compra-de-arma-de-fogo-para-cacador-cac',
  'operador-de-pistola-nivel-i','vip-operador-de-pistola-nivel-i',
  'mandado-de-seguranca','recurso-administrativo'
)
AND (exige_acervo IS NULL OR exige_acervo = false);

UPDATE public.qa_servicos_catalogo
SET exige_cr = true
WHERE slug IN (
  'renovacao-cr','apostilamento-atualizacao','craf-sigma','gte',
  'guia-de-trafego-especial-cac','registro-e-apostilamento-de-arma-de-fogo-cac',
  'autorizacao-de-compra-de-arma-de-fogo-atirador-esportivo-cac',
  'autorizacao-de-compra-de-arma-de-fogo-para-cacador-cac',
  'porte-arma-fogo','autorizacao-compra','renovacao-porte',
  'renovacao-de-porte-de-arma-de-fogo','mudanca-servico'
);

UPDATE public.qa_servicos_catalogo
SET exige_cr = false
WHERE slug IN (
  'concessao-cr','posse-arma-fogo','aquisicao-registro-posse-de-arma-de-fogo',
  'operador-de-pistola-nivel-i','vip-operador-de-pistola-nivel-i',
  'mandado-de-seguranca','recurso-administrativo','registro-arma-fogo',
  'registro-de-arma-de-fogo','renovacao-posse-de-arma-de-fogo'
)
AND exige_cr IS NULL;
