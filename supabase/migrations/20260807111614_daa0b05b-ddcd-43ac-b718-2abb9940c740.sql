ALTER TABLE public.qa_tipos_documento_catalogo
  ADD COLUMN IF NOT EXISTS regime text NOT NULL DEFAULT 'comum';

ALTER TABLE public.qa_tipos_documento_catalogo
  DROP CONSTRAINT IF EXISTS qa_tipos_documento_catalogo_regime_check;

ALTER TABLE public.qa_tipos_documento_catalogo
  ADD CONSTRAINT qa_tipos_documento_catalogo_regime_check
  CHECK (regime IN ('comum','defesa_pessoal','cac'));

UPDATE public.qa_tipos_documento_catalogo SET regime = 'comum';

UPDATE public.qa_tipos_documento_catalogo
  SET regime = 'cac'
  WHERE categoria_hub = 'cac_atividade'
     OR escopo_documental = 'cac_atividade'
     OR tipo_documento IN ('cr','habilitacao_cacador_ibama');

UPDATE public.qa_tipos_documento_catalogo
  SET regime = 'defesa_pessoal'
  WHERE tipo_documento IN (
    'comprovante_efetiva_necessidade',
    'documento_complementar_caso',
    'requerimento_de_posse_de_arma_de_fogo'
  );

CREATE INDEX IF NOT EXISTS idx_qa_tipos_doc_catalogo_regime
  ON public.qa_tipos_documento_catalogo (regime);

COMMENT ON COLUMN public.qa_tipos_documento_catalogo.regime IS
  'Teoria dos conjuntos: comum = interseção (vale para defesa pessoal e CAC); defesa_pessoal e cac = exclusivos do regime.';