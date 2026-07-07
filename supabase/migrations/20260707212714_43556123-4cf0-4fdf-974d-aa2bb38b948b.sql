CREATE TABLE IF NOT EXISTS public.qa_competencia_materia (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  materia_slug      text NOT NULL UNIQUE,
  materia_descricao text NOT NULL,
  palavras_chave    text[] NOT NULL DEFAULT '{}',
  orgao_competente  text NOT NULL CHECK (orgao_competente IN ('PF','Exercito','indeterminado')),
  sistema_registro  text NOT NULL CHECK (sistema_registro IN ('SINARM','SINARM-CAC','SIGMA','SisGCorp','indeterminado')),
  fonte_normativa_id uuid REFERENCES public.qa_fontes_normativas(id),
  artigo            text,
  vigencia_inicio   date,
  observacao        text,
  ativo             boolean NOT NULL DEFAULT true,
  atualizado_em     timestamptz NOT NULL DEFAULT now(),
  atualizado_por    text
);

CREATE INDEX IF NOT EXISTS idx_competencia_palavras ON public.qa_competencia_materia USING GIN (palavras_chave);

GRANT SELECT ON public.qa_competencia_materia TO authenticated;
GRANT ALL ON public.qa_competencia_materia TO service_role;

ALTER TABLE public.qa_competencia_materia ENABLE ROW LEVEL SECURITY;

CREATE POLICY competencia_select ON public.qa_competencia_materia
  FOR SELECT TO authenticated USING (true);

INSERT INTO public.qa_competencia_materia
  (materia_slug, materia_descricao, palavras_chave, orgao_competente, sistema_registro, artigo, observacao)
VALUES
  ('registro-cac',
   'Registro de arma de fogo para Colecionador, Atirador e Caçador (CAC)',
   ARRAY['cac','cr','concessao','registro','atirador','colecionador','cacador','cacadora','atiradora','clube','sinarm','pf','policia federal'],
   'PF','SINARM-CAC',
   'Lei 10.826/2003 art. 5º-B; Decreto 11.615/2023',
   'Registro e Certificado de Registro para atividade CAC competem à Polícia Federal via SINARM-CAC.'),
  ('porte-civil',
   'Porte de arma de fogo para uso pessoal (civil não-institucional)',
   ARRAY['porte','concessao porte','uso pessoal','defesa pessoal','civil','sinarm'],
   'PF','SINARM',
   'Lei 10.826/2003 art. 6º',
   'Porte civil é competência da Polícia Federal via SINARM.'),
  ('registro-civil-uso-restrito',
   'Registro de arma de fogo de uso restrito para civil (colecionador)',
   ARRAY['uso restrito','colecao','colecionar','sigma','exercito'],
   'Exercito','SIGMA',
   'Lei 10.826/2003 art. 16; Decreto 9.846/2019',
   'Armas de uso restrito de colecionadores: competência do Exército via SIGMA.'),
  ('acervo-policial',
   'Registro de acervo de órgão de segurança pública estadual ou municipal',
   ARRAY['acervo','policia civil','guarda municipal','policia militar','gcm','orgao','sigma','exercito'],
   'Exercito','SIGMA',
   'Lei 10.826/2003 art. 20',
   'Registro de acervo de órgãos de segurança: Exército via SIGMA.'),
  ('industria-comercio',
   'Fabricação, importação e comércio de armas de fogo',
   ARRAY['fabricante','importador','comerciante','loja','comercio','industria','sigma','exercito'],
   'Exercito','SIGMA',
   'Lei 10.826/2003 art. 28 e ss.',
   'Atividades industriais e comerciais de armas: Exército via SIGMA.'),
  ('apostilamento-cac',
   'Apostilamento / atualização de arma em acervo CAC',
   ARRAY['apostilamento','apostilar','atualizacao','acervo cac','aditamento','sinarm-cac','pf'],
   'PF','SINARM-CAC',
   'Decreto 11.615/2023',
   'Apostilamento de acervo CAC: Polícia Federal via SINARM-CAC.')
ON CONFLICT (materia_slug) DO NOTHING;