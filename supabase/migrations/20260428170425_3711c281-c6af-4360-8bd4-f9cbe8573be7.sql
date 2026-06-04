-- ============================================================================
-- 1) Tabela catálogo central de serviços/produtos
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.qa_servicos_catalogo (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            text NOT NULL UNIQUE,
  nome            text NOT NULL,
  categoria       text NOT NULL,
  tipo            text NOT NULL DEFAULT 'servico' CHECK (tipo IN ('servico','produto')),
  descricao_curta text,
  descricao_full  text,
  preco           numeric(12,2),
  recorrente      boolean NOT NULL DEFAULT false,
  exige_cadastro  boolean NOT NULL DEFAULT true,
  exige_pagamento boolean NOT NULL DEFAULT true,
  gera_processo   boolean NOT NULL DEFAULT true,
  tipo_processo   text,
  checklist_type  text,
  contrato_type   text,
  ativo           boolean NOT NULL DEFAULT true,
  servico_id      integer REFERENCES public.qa_servicos(id) ON DELETE SET NULL,
  -- mapeamento p/ Step0 do cadastro (qaServiceCatalog.ts)
  objetivo_slug          text,
  categoria_servico_slug text,
  servico_principal_slug text,
  display_order   integer NOT NULL DEFAULT 100,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qa_servicos_catalogo_ativo ON public.qa_servicos_catalogo (ativo, display_order);
CREATE INDEX IF NOT EXISTS idx_qa_servicos_catalogo_categoria ON public.qa_servicos_catalogo (categoria);

ALTER TABLE public.qa_servicos_catalogo ENABLE ROW LEVEL SECURITY;

-- Leitura: pública (catálogo aparece no site e portal sem login)
DROP POLICY IF EXISTS "qa_servicos_catalogo_public_read" ON public.qa_servicos_catalogo;
CREATE POLICY "qa_servicos_catalogo_public_read"
  ON public.qa_servicos_catalogo FOR SELECT
  USING (ativo = true);

-- Escrita: somente staff QA (admin/operador)
DROP POLICY IF EXISTS "qa_servicos_catalogo_staff_write" ON public.qa_servicos_catalogo;
CREATE POLICY "qa_servicos_catalogo_staff_write"
  ON public.qa_servicos_catalogo FOR ALL
  USING (public.qa_is_active_staff(auth.uid()))
  WITH CHECK (public.qa_is_active_staff(auth.uid()));

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_qa_servicos_catalogo_updated_at ON public.qa_servicos_catalogo;
CREATE TRIGGER trg_qa_servicos_catalogo_updated_at
  BEFORE UPDATE ON public.qa_servicos_catalogo
  FOR EACH ROW EXECUTE FUNCTION public.lp_set_updated_at();

-- ============================================================================
-- 2) Seed inicial — serviços principais Quero Armas
-- ============================================================================
INSERT INTO public.qa_servicos_catalogo
  (slug, nome, categoria, tipo, descricao_curta, exige_pagamento, gera_processo, tipo_processo, checklist_type, ativo, servico_id, objetivo_slug, categoria_servico_slug, servico_principal_slug, display_order)
VALUES
  -- POLÍCIA FEDERAL
  ('posse-arma-fogo', 'Posse de arma de fogo', 'Polícia Federal', 'servico',
    'Autorização para manter arma de fogo no domicílio ou local de trabalho.', true, true, 'posse_arma_fogo', 'posse_arma_fogo', true, 2,
    'defesa_pessoal', 'sinarm_pf', 'aquisicao_posse', 10),
  ('porte-arma-fogo', 'Porte de arma de fogo', 'Polícia Federal', 'servico',
    'Autorização para portar arma de fogo fora do domicílio.', true, true, 'porte_arma_fogo', 'porte_arma_fogo', true, 3,
    'defesa_pessoal', 'sinarm_pf', 'porte_arma', 20),
  ('registro-arma-fogo', 'Registro de arma de fogo (CRAF)', 'Polícia Federal', 'servico',
    'Emissão ou renovação de Certificado de Registro de Arma de Fogo.', true, true, 'craf', 'craf', true, 26,
    'defesa_pessoal', 'sinarm_pf', 'emissao_craf', 30),
  ('autorizacao-compra', 'Autorização de compra de arma de fogo', 'Polícia Federal', 'servico',
    'Autorização para aquisição de nova arma de fogo.', true, true, 'autorizacao_compra', 'autorizacao_compra', true, 15,
    'defesa_pessoal', 'sinarm_pf', 'aquisicao_posse', 40),
  ('renovacao-porte', 'Renovação de porte', 'Polícia Federal', 'servico',
    'Renovação do porte de arma de fogo já emitido.', true, true, 'porte_arma_fogo', 'porte_arma_fogo', true, NULL,
    'defesa_pessoal', 'sinarm_pf', 'renovacao_porte', 50),

  -- EXÉRCITO / SIGMA
  ('concessao-cr', 'Concessão de CR', 'Exército / SIGMA', 'servico',
    'Concessão de Certificado de Registro junto ao Exército Brasileiro.', true, true, 'cr', 'cr', true, 20,
    'tiro_esportivo', 'sinarm_cac_cr', 'concessao_cr', 60),
  ('renovacao-cr', 'Renovação de CR', 'Exército / SIGMA', 'servico',
    'Renovação do Certificado de Registro CAC.', true, true, 'cr', 'cr', true, NULL,
    'tiro_esportivo', 'sinarm_cac_cr', 'renovacao_cr', 70),
  ('apostilamento-atualizacao', 'Apostilamento — Atualização de acervo', 'Exército / SIGMA', 'servico',
    'Atualização do acervo CAC junto ao SIGMA.', true, true, 'apostilamento', 'apostilamento', true, 8,
    'tiro_esportivo', 'sinarm_cac_cr', 'apostilamento_recarga', 80),
  ('craf-sigma', 'CRAF (SIGMA)', 'Exército / SIGMA', 'servico',
    'Emissão de CRAF para acervo CAC.', true, true, 'craf', 'craf', true, NULL,
    'tiro_esportivo', 'sinarm_cac_cr', 'aquisicao_acervo', 90),
  ('gte', 'GTE — Guia de Tráfego Especial', 'Exército / SIGMA', 'servico',
    'Emissão de Guia de Tráfego Especial para arma de fogo.', true, true, 'gte', 'gte', true, 18,
    'tiro_esportivo', 'sinarm_cac_cr', 'guia_trafego', 100),

  -- TROCA / OUTROS
  ('mudanca-servico', 'Mudança de serviço (Posse → CR)', 'Mudança de serviço', 'servico',
    'Migração de Posse PF para Concessão de CR no Exército.', true, true, 'mudanca_servico', 'mudanca_servico', true, 13,
    'regularizacao', 'sinarm_pf', 'aquisicao_posse', 200)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- 3) Correção cirúrgica — Willian (cliente_id=46): processos estavam como Posse,
--    mas o serviço real contratado (qa_itens_venda 224) é Porte (servico_id=3).
-- ============================================================================
UPDATE public.qa_processos
   SET servico_id   = 3,
       servico_nome = 'Porte na Polícia Federal',
       updated_at   = now()
 WHERE cliente_id = 46
   AND servico_id = 2;

-- Audit trail
INSERT INTO public.qa_processo_eventos (processo_id, tipo_evento, descricao, dados_json, ator)
SELECT p.id,
       'servico_corrigido',
       'Serviço corrigido de Posse (id=2) para Porte (id=3) — alinhado ao item de venda real do cliente.',
       jsonb_build_object('de_servico_id', 2, 'para_servico_id', 3, 'motivo', 'correcao_bug_porte_virou_posse'),
       'sistema'
  FROM public.qa_processos p
 WHERE p.cliente_id = 46 AND p.servico_id = 3;