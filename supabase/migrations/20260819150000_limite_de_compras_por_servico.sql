-- ============================================================================
-- LIMITE DE COMPRAS POR SERVIÇO E POR CATEGORIA DO TITULAR
--
-- Auditoria de 19/08/2026: um cliente fechou o mesmo carrinho duas vezes em
-- quatro minutos e o sistema abriu processo para as duas compras. Travar
-- qualquer recompra seria errado — a posse admite mais de uma arma. Então o
-- limite passa a ser DADO, não regra escondida no código:
--
--   posse / autorização de compra → 2 para cidadão comum, 4 para segurança
--                                   pública (uma linha por categoria)
--   mudança de serviço            → 1 (acontece uma vez)
--   serviço sem linha aqui        → SEM limite, o checkout não trava
--
-- Fora disso, o checkout recusa apenas a repetição em menos de 30 minutos, que
-- é acidente e não escolha. Nos dois casos a Equipe pode confirmar e seguir.
--
-- Para mudar um limite, é UPDATE nesta tabela — não precisa de deploy.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.qa_servicos_limite_compra (
  id                bigserial PRIMARY KEY,
  servico_slug      text NOT NULL
                      REFERENCES public.qa_servicos_catalogo(slug)
                      ON UPDATE CASCADE ON DELETE CASCADE,
  -- NULL = vale para qualquer categoria (é o limite base do serviço).
  categoria_titular text NULL CHECK (
    categoria_titular IS NULL OR categoria_titular IN (
      'pessoa_fisica','pessoa_juridica','seguranca_publica','magistrado_mp','militar'
    )
  ),
  limite            integer NOT NULL CHECK (limite > 0),
  observacao        text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.qa_servicos_limite_compra IS
  'Quantas vezes o mesmo cliente pode contratar cada serviço. Serviço ausente = sem limite.';

CREATE UNIQUE INDEX IF NOT EXISTS uq_qa_servicos_limite_compra
  ON public.qa_servicos_limite_compra (servico_slug, COALESCE(categoria_titular, '*'));

ALTER TABLE public.qa_servicos_limite_compra ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS qa_servicos_limite_compra_staff_le ON public.qa_servicos_limite_compra;
CREATE POLICY qa_servicos_limite_compra_staff_le
  ON public.qa_servicos_limite_compra FOR SELECT TO authenticated
  USING (public.qa_is_active_staff(auth.uid()));

DROP POLICY IF EXISTS qa_servicos_limite_compra_staff_escreve ON public.qa_servicos_limite_compra;
CREATE POLICY qa_servicos_limite_compra_staff_escreve
  ON public.qa_servicos_limite_compra FOR ALL TO authenticated
  USING (public.qa_is_active_staff(auth.uid()))
  WITH CHECK (public.qa_is_active_staff(auth.uid()));

-- ── Limites conhecidos ──────────────────────────────────────────────────────
-- Só entra a linha cujo serviço existe no catálogo; o resto é ignorado.
INSERT INTO public.qa_servicos_limite_compra (servico_slug, categoria_titular, limite, observacao)
SELECT v.slug, v.categoria, v.limite, v.observacao
  FROM (VALUES
    ('autorizacao-de-compra-posse-de-arma-de-fogo', NULL,
     2, 'Posse: cidadao comum pode ter ate 2 armas.'),
    ('autorizacao-de-compra-posse-de-arma-de-fogo', 'seguranca_publica',
     4, 'Seguranca publica: ate 4 armas.'),
    ('certificado-de-registro-de-arma-de-fogo-craf-e-guia-de-transito-gt-posse-de-arma', NULL,
     2, 'Um CRAF por arma — acompanha o limite da posse do cidadao comum.'),
    ('certificado-de-registro-de-arma-de-fogo-craf-e-guia-de-transito-gt-posse-de-arma', 'seguranca_publica',
     4, 'Um CRAF por arma — acompanha o limite da seguranca publica.'),
    ('mudanca-servico', NULL,
     1, 'Migracao de posse para CR acontece uma vez por cliente.')
  ) AS v(slug, categoria, limite, observacao)
  JOIN public.qa_servicos_catalogo c ON c.slug = v.slug
ON CONFLICT (servico_slug, COALESCE(categoria_titular, '*')) DO NOTHING;

-- ── Conferência ─────────────────────────────────────────────────────────────
SELECT l.servico_slug,
       COALESCE(l.categoria_titular, '(todas as categorias)') AS categoria,
       l.limite,
       l.observacao
  FROM public.qa_servicos_limite_compra l
 ORDER BY l.servico_slug, l.categoria_titular NULLS FIRST;
