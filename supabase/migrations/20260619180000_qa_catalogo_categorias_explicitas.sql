-- Garante que cada serviço do catálogo tenha a categoria correta,
-- independente do valor anterior. Corrige variações de nomenclatura.

-- ── SINARM CAC (Exército — antigo SIGMA) ──────────────────────────────────────
-- Serviços de CR de CAC, acervo, registro de atiradores/caçadores/colecionadores
UPDATE public.qa_servicos_catalogo
SET categoria = 'SINARM CAC'
WHERE slug IN (
  'concessao-cr',
  'renovacao-cr',
  'apostilamento-atualizacao',
  'craf-sigma',
  'gte',
  'guia-de-trafego-especial-cac',
  'registro-e-apostilamento-de-arma-de-fogo-cac',
  'autorizacao-de-compra-de-arma-de-fogo-atirador-esportivo-cac',
  'autorizacao-de-compra-de-arma-de-fogo-para-cacador-cac'
);

-- ── Polícia Federal (SINARM PF) ───────────────────────────────────────────────
-- Serviços de posse, porte, aquisição para defesa pessoal
UPDATE public.qa_servicos_catalogo
SET categoria = 'Polícia Federal'
WHERE slug IN (
  'posse-arma-fogo',
  'porte-arma-fogo',
  'autorizacao-compra',
  'aquisicao-registro-posse-de-arma-de-fogo',
  'renovacao-posse-de-arma-de-fogo',
  'renovacao-porte',
  'renovacao-de-porte-de-arma-de-fogo',
  'registro-arma-fogo',
  'registro-de-arma-de-fogo',
  'operador-de-pistola-nivel-i',
  'vip-operador-de-pistola-nivel-i'
);

-- ── Jurídico / Administrativo ─────────────────────────────────────────────────
UPDATE public.qa_servicos_catalogo
SET categoria = 'Jurídico'
WHERE slug IN (
  'mandado-de-seguranca',
  'recurso-administrativo'
);

-- ── Mudança de serviço ────────────────────────────────────────────────────────
UPDATE public.qa_servicos_catalogo
SET categoria = 'Mudança de serviço'
WHERE slug IN (
  'mudanca-servico'
);
