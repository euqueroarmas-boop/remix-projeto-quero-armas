ALTER TABLE public.qa_efetiva_necessidade
  ADD COLUMN IF NOT EXISTS texto_bo text,
  ADD COLUMN IF NOT EXISTS texto_bo_gerado_em timestamptz,
  ADD COLUMN IF NOT EXISTS texto_bo_editado_pelo_cliente boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bo_pendente_registro boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS versao integer NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS public.qa_efetiva_necessidade_acrescimos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  efetiva_necessidade_id uuid NOT NULL REFERENCES public.qa_efetiva_necessidade(id) ON DELETE CASCADE,
  texto text NOT NULL,
  ordem integer NOT NULL DEFAULT 1,
  origem text NOT NULL DEFAULT 'cliente',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.qa_efetiva_necessidade_acrescimos TO authenticated;
GRANT SELECT, INSERT ON public.qa_efetiva_necessidade_acrescimos TO anon;
GRANT ALL ON public.qa_efetiva_necessidade_acrescimos TO service_role;

ALTER TABLE public.qa_efetiva_necessidade_acrescimos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "acrescimos leitura e escrita como o registro pai"
  ON public.qa_efetiva_necessidade_acrescimos
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.qa_efetiva_necessidade e WHERE e.id = efetiva_necessidade_id))
  WITH CHECK (EXISTS (SELECT 1 FROM public.qa_efetiva_necessidade e WHERE e.id = efetiva_necessidade_id));

CREATE INDEX IF NOT EXISTS idx_qa_efetiva_acrescimos_registro
  ON public.qa_efetiva_necessidade_acrescimos (efetiva_necessidade_id, ordem);

CREATE TABLE IF NOT EXISTS public.qa_bo_links_uf (
  uf text PRIMARY KEY,
  nome_orgao text,
  url_abrir text,
  url_acompanhar text,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.qa_bo_links_uf TO anon;
GRANT SELECT ON public.qa_bo_links_uf TO authenticated;
GRANT ALL ON public.qa_bo_links_uf TO service_role;

ALTER TABLE public.qa_bo_links_uf ENABLE ROW LEVEL SECURITY;

CREATE POLICY "links de BO sao publicos para leitura"
  ON public.qa_bo_links_uf FOR SELECT USING (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_qa_efetiva_acrescimos_updated ON public.qa_efetiva_necessidade_acrescimos;
CREATE TRIGGER trg_qa_efetiva_acrescimos_updated
  BEFORE UPDATE ON public.qa_efetiva_necessidade_acrescimos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_qa_bo_links_uf_updated ON public.qa_bo_links_uf;
CREATE TRIGGER trg_qa_bo_links_uf_updated
  BEFORE UPDATE ON public.qa_bo_links_uf
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.qa_bo_links_uf (uf, nome_orgao, url_abrir, url_acompanhar, observacao)
VALUES (
  'SP',
  'Polícia Civil do Estado de São Paulo — Delegacia Eletrônica',
  'https://www.delegaciaeletronica.policiacivil.sp.gov.br/ssp-de-cidadao/pages/comunicar-ocorrencia',
  'https://www.delegaciaeletronica.policiacivil.sp.gov.br/ssp-de-cidadao/pages/acompanhar-andamento',
  'Para acompanhar, tenha em mãos o número do protocolo ou do boletim de ocorrência, o ano do registro e o CPF do declarante.'
)
ON CONFLICT (uf) DO UPDATE SET
  nome_orgao = EXCLUDED.nome_orgao,
  url_abrir = EXCLUDED.url_abrir,
  url_acompanhar = EXCLUDED.url_acompanhar,
  observacao = EXCLUDED.observacao,
  updated_at = now();