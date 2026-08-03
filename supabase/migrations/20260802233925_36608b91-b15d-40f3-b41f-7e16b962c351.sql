CREATE TABLE public.qa_klal_persona (
  id INTEGER PRIMARY KEY DEFAULT 1,
  humor SMALLINT NOT NULL DEFAULT 50,
  seriedade SMALLINT NOT NULL DEFAULT 75,
  preocupacao SMALLINT NOT NULL DEFAULT 90,
  min_caracteres INTEGER NOT NULL DEFAULT 180,
  max_caracteres INTEGER NOT NULL DEFAULT 400,
  regras_extras TEXT,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT qa_klal_persona_singleton CHECK (id = 1)
);

GRANT SELECT, INSERT, UPDATE ON public.qa_klal_persona TO authenticated;
GRANT ALL ON public.qa_klal_persona TO service_role;

ALTER TABLE public.qa_klal_persona ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Equipe autenticada le persona do Klal"
ON public.qa_klal_persona FOR SELECT TO authenticated USING (true);

CREATE POLICY "Equipe autenticada cria persona do Klal"
ON public.qa_klal_persona FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Equipe autenticada atualiza persona do Klal"
ON public.qa_klal_persona FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

INSERT INTO public.qa_klal_persona (id) VALUES (1) ON CONFLICT (id) DO NOTHING;