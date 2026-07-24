
-- 1) Novos campos no catálogo
ALTER TABLE public.qa_servicos_catalogo
  ADD COLUMN IF NOT EXISTS standalone_permitido boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS ordem_no_pacote integer,
  ADD COLUMN IF NOT EXISTS pacote_slug text;

COMMENT ON COLUMN public.qa_servicos_catalogo.standalone_permitido IS
  'Se true, o serviço pode ser contratado/executado isoladamente (sem pré-requisito). Se false, exige que o(s) pré-requisito(s) obrigatório(s) estejam concluídos.';
COMMENT ON COLUMN public.qa_servicos_catalogo.ordem_no_pacote IS
  'Posição canônica do serviço dentro de um pacote/pipeline (menor = mais cedo).';
COMMENT ON COLUMN public.qa_servicos_catalogo.pacote_slug IS
  'Identificador opcional do pacote/pipeline ao qual o serviço pertence.';

-- 2) Tabela de pré-requisitos entre serviços do catálogo
CREATE TABLE IF NOT EXISTS public.qa_servicos_prerequisitos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  servico_slug text NOT NULL REFERENCES public.qa_servicos_catalogo(slug) ON DELETE CASCADE,
  prerequisito_slug text NOT NULL REFERENCES public.qa_servicos_catalogo(slug) ON DELETE CASCADE,
  tipo text NOT NULL DEFAULT 'obrigatorio',
  observacao text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT qa_servicos_prerequisitos_tipo_check
    CHECK (tipo IN ('obrigatorio','preferencial')),
  CONSTRAINT qa_servicos_prerequisitos_no_self
    CHECK (servico_slug <> prerequisito_slug),
  CONSTRAINT qa_servicos_prerequisitos_unique
    UNIQUE (servico_slug, prerequisito_slug)
);

GRANT SELECT ON public.qa_servicos_prerequisitos TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.qa_servicos_prerequisitos TO authenticated;
GRANT ALL ON public.qa_servicos_prerequisitos TO service_role;

ALTER TABLE public.qa_servicos_prerequisitos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qa_servicos_prerequisitos_public_read"
  ON public.qa_servicos_prerequisitos
  FOR SELECT
  USING (ativo = true);

CREATE POLICY "qa_servicos_prerequisitos_staff_write"
  ON public.qa_servicos_prerequisitos
  FOR ALL
  USING (public.qa_is_active_staff(auth.uid()))
  WITH CHECK (public.qa_is_active_staff(auth.uid()));

CREATE TRIGGER trg_qa_servicos_prerequisitos_updated_at
  BEFORE UPDATE ON public.qa_servicos_prerequisitos
  FOR EACH ROW EXECUTE FUNCTION public.lp_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_qa_servicos_prerequisitos_servico
  ON public.qa_servicos_prerequisitos(servico_slug) WHERE ativo = true;
CREATE INDEX IF NOT EXISTS idx_qa_servicos_prerequisitos_prereq
  ON public.qa_servicos_prerequisitos(prerequisito_slug) WHERE ativo = true;

-- 3) Configura par 60 (AUTORIZAÇÃO POSSE) → 59 (CRAF+GT POSSE)
UPDATE public.qa_servicos_catalogo
   SET pacote_slug = 'posse-arma-de-fogo',
       ordem_no_pacote = 10,
       standalone_permitido = true
 WHERE slug = 'autorizacao-de-compra-posse-de-arma-de-fogo';

UPDATE public.qa_servicos_catalogo
   SET pacote_slug = 'posse-arma-de-fogo',
       ordem_no_pacote = 20,
       standalone_permitido = true
 WHERE slug = 'certificado-de-registro-de-arma-de-fogo-craf-e-guia-de-transito-gt-posse-de-arma';

INSERT INTO public.qa_servicos_prerequisitos (servico_slug, prerequisito_slug, tipo, observacao)
VALUES (
  'certificado-de-registro-de-arma-de-fogo-craf-e-guia-de-transito-gt-posse-de-arma',
  'autorizacao-de-compra-posse-de-arma-de-fogo',
  'preferencial',
  'CRAF+GT depende da Autorização de Compra. Standalone permitido quando o cliente apresenta autorização emitida por outro despachante (PDF externo).'
)
ON CONFLICT (servico_slug, prerequisito_slug) DO UPDATE
  SET tipo = EXCLUDED.tipo,
      observacao = EXCLUDED.observacao,
      ativo = true,
      updated_at = now();
