
-- Table for PF circumscription mapping
CREATE TABLE public.qa_circunscricoes_pf (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_pf text NOT NULL,
  sigla_unidade text,
  tipo_unidade text NOT NULL DEFAULT 'delegacia',
  municipio_sede text NOT NULL,
  uf text NOT NULL,
  municipios_cobertos text[] NOT NULL DEFAULT '{}',
  base_legal text DEFAULT 'Portaria DG/PF nº 16.145/2022',
  ato_normativo text DEFAULT 'Portaria DG/PF nº 16.145, de 26 de abril de 2022, alterada pela Portaria DG/PF nº 16.797, de 10 de novembro de 2022',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.qa_circunscricoes_pf ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Anyone can read qa_circunscricoes_pf"
  ON public.qa_circunscricoes_pf FOR SELECT
  TO anon, authenticated
  USING (true);

-- Service role full access
CREATE POLICY "Service role full access qa_circunscricoes_pf"
  ON public.qa_circunscricoes_pf FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- Index for fast municipality lookup
CREATE INDEX idx_qa_circunscricoes_pf_uf ON public.qa_circunscricoes_pf (uf);
CREATE INDEX idx_qa_circunscricoes_pf_municipios ON public.qa_circunscricoes_pf USING GIN (municipios_cobertos);

-- Function to resolve PF unit from municipality + UF
CREATE OR REPLACE FUNCTION public.qa_resolver_circunscricao_pf(p_municipio text, p_uf text)
RETURNS TABLE(unidade_pf text, sigla_unidade text, tipo_unidade text, municipio_sede text, uf text, base_legal text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT c.unidade_pf, c.sigla_unidade, c.tipo_unidade, c.municipio_sede, c.uf, c.base_legal
  FROM public.qa_circunscricoes_pf c
  WHERE c.uf = upper(trim(p_uf))
    AND upper(trim(p_municipio)) = ANY(
      SELECT upper(trim(m)) FROM unnest(c.municipios_cobertos) AS m
    )
  LIMIT 1;
$$;
