CREATE TABLE public.qa_regras_categoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  servico_id integer NULL,
  categoria text NOT NULL,
  corporacao text NULL,
  grupo_id text NOT NULL,
  tipo_documento text NULL,
  modo text NOT NULL DEFAULT 'exigido',
  base_legal text NULL,
  registro text NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT qa_regras_categoria_modo_chk CHECK (modo IN ('exigido','alternativo','dispensado')),
  CONSTRAINT qa_regras_categoria_registro_chk CHECK (registro IS NULL OR registro IN ('sinarm','sigma'))
);

CREATE UNIQUE INDEX qa_regras_categoria_uniq
  ON public.qa_regras_categoria (
    COALESCE(servico_id, -1),
    categoria,
    COALESCE(corporacao, ''),
    grupo_id,
    COALESCE(tipo_documento, '')
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.qa_regras_categoria TO authenticated;
GRANT ALL ON public.qa_regras_categoria TO service_role;

ALTER TABLE public.qa_regras_categoria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qa_regras_categoria_select_auth"
  ON public.qa_regras_categoria FOR SELECT TO authenticated USING (true);

CREATE POLICY "qa_regras_categoria_write_staff"
  ON public.qa_regras_categoria FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.qa_usuarios_perfis p WHERE p.user_id = auth.uid() AND p.ativo = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.qa_usuarios_perfis p WHERE p.user_id = auth.uid() AND p.ativo = true));

CREATE TRIGGER trg_qa_regras_categoria_updated_at
  BEFORE UPDATE ON public.qa_regras_categoria
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();