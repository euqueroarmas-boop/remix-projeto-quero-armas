CREATE TABLE public.qa_psico_nao_localizados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL DEFAULT 'psicologo',
  nome text NOT NULL,
  registro text,
  endereco text,
  cidade text,
  uf text,
  telefone text,
  qa_cliente_id bigint,
  documento_id uuid,
  cliente_nome text,
  situacao text NOT NULL DEFAULT 'pendente',
  observacoes text,
  ocorrencias integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX qa_psico_nao_localizados_uniq
  ON public.qa_psico_nao_localizados (tipo, lower(nome), coalesce(regexp_replace(coalesce(registro,''), '\D', '', 'g'), ''));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.qa_psico_nao_localizados TO authenticated;
GRANT ALL ON public.qa_psico_nao_localizados TO service_role;

ALTER TABLE public.qa_psico_nao_localizados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Equipe autenticada gerencia nao localizados"
ON public.qa_psico_nao_localizados FOR ALL TO authenticated
USING (true) WITH CHECK (true);

CREATE TRIGGER trg_qa_psico_nao_localizados_updated
BEFORE UPDATE ON public.qa_psico_nao_localizados
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();