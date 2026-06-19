-- Classifica cada serviço do catálogo em dois eixos para filtro inteligente no wizard.
--
-- exige_acervo: true = cliente precisa de arma/acervo JÁ REGISTRADO
-- exige_cr:     true = cliente precisa de CR ativo no Exército
--
-- Combinação de filtros no portal:
--   trilha=inicial + possuiArma=nao  → exige_acervo IS NOT TRUE AND exige_cr IS NOT TRUE
--   trilha=inicial + possuiArma=sim  → exige_acervo IS NOT TRUE
--   trilha=continuidade              → exige_acervo IS NOT FALSE

-- ── 1) Adiciona coluna exige_cr ───────────────────────────────────────────────
ALTER TABLE public.qa_servicos_catalogo
  ADD COLUMN IF NOT EXISTS exige_cr BOOLEAN NULL;

COMMENT ON COLUMN public.qa_servicos_catalogo.exige_cr IS
  'true = requer CR ativo do CAC pré-existente. false = não requer CR preexistente. NULL = não classificado.';

-- ── 2) Preenche exige_acervo (corrige todos os NULL) ─────────────────────────
-- Serviços que exigem acervo já registrado (arma em nome do cliente)
UPDATE public.qa_servicos_catalogo
SET exige_acervo = true
WHERE slug IN (
  'apostilamento-atualizacao',           -- atualiza acervo existente
  'craf-sigma',                          -- CRAF para acervo CAC
  'gte',                                 -- guia de tráfego (arma existente)
  'guia-de-trafego-especial-cac',        -- idem (slug alternativo)
  'registro-e-apostilamento-de-arma-de-fogo-cac',  -- registra arma própria
  'renovacao-posse-de-arma-de-fogo',     -- renova posse existente
  'renovacao-porte',                     -- renova porte existente
  'renovacao-de-porte-de-arma-de-fogo',  -- idem (slug alternativo)
  'registro-arma-fogo',                  -- emite CRAF para arma que já tem
  'registro-de-arma-de-fogo',            -- idem (slug alternativo)
  'mudanca-servico'                      -- migra Posse→CR (tem arma registrada)
);

-- Serviços sem exigência de acervo (quem ainda não tem arma pode contratar)
UPDATE public.qa_servicos_catalogo
SET exige_acervo = false
WHERE slug IN (
  'concessao-cr',
  'renovacao-cr',
  'posse-arma-fogo',
  'porte-arma-fogo',
  'autorizacao-compra',
  'aquisicao-registro-posse-de-arma-de-fogo',
  'autorizacao-de-compra-de-arma-de-fogo-atirador-esportivo-cac',
  'autorizacao-de-compra-de-arma-de-fogo-para-cacador-cac',
  'operador-de-pistola-nivel-i',
  'vip-operador-de-pistola-nivel-i',
  'mandado-de-seguranca',
  'recurso-administrativo'
)
AND (exige_acervo IS NULL OR exige_acervo = false);

-- ── 3) Preenche exige_cr ──────────────────────────────────────────────────────
-- Serviços que exigem CR ativo (só CAC com CR já concedido pode contratar)
UPDATE public.qa_servicos_catalogo
SET exige_cr = true
WHERE slug IN (
  'renovacao-cr',                                           -- renova CR existente
  'apostilamento-atualizacao',                              -- atualiza acervo → precisa CR
  'craf-sigma',                                             -- CRAF do CAC
  'gte',
  'guia-de-trafego-especial-cac',
  'registro-e-apostilamento-de-arma-de-fogo-cac',
  'autorizacao-de-compra-de-arma-de-fogo-atirador-esportivo-cac',
  'autorizacao-de-compra-de-arma-de-fogo-para-cacador-cac',
  'porte-arma-fogo',      -- porte defesa pessoal (trilha diferente, exclui quem busca CR)
  'autorizacao-compra',   -- autorização PF (trilha defesa pessoal)
  'renovacao-porte',
  'renovacao-de-porte-de-arma-de-fogo',
  'mudanca-servico'
);

-- Serviços sem exigência de CR
UPDATE public.qa_servicos_catalogo
SET exige_cr = false
WHERE slug IN (
  'concessao-cr',
  'posse-arma-fogo',
  'aquisicao-registro-posse-de-arma-de-fogo',
  'operador-de-pistola-nivel-i',
  'vip-operador-de-pistola-nivel-i',
  'mandado-de-seguranca',
  'recurso-administrativo',
  'registro-arma-fogo',
  'registro-de-arma-de-fogo',
  'renovacao-posse-de-arma-de-fogo'
)
AND exige_cr IS NULL;
