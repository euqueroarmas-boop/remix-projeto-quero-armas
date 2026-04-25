-- Criar tabela de muniçōes do cliente (estoque por calibre)
CREATE TABLE IF NOT EXISTS public.qa_municoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id integer NOT NULL,
  calibre text NOT NULL,
  quantidade integer NOT NULL DEFAULT 0,
  marca text,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qa_municoes_cliente ON public.qa_municoes(cliente_id);
CREATE INDEX IF NOT EXISTS idx_qa_municoes_calibre ON public.qa_municoes(calibre);

ALTER TABLE public.qa_municoes ENABLE ROW LEVEL SECURITY;

-- Mantém o padrão das demais tabelas qa_* (acesso amplo, controle no app)
CREATE POLICY "Auth full access qa_municoes" ON public.qa_municoes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Anon full access qa_municoes" ON public.qa_municoes
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- Trigger updated_at reaproveitando função existente
CREATE TRIGGER trg_qa_municoes_updated
  BEFORE UPDATE ON public.qa_municoes
  FOR EACH ROW EXECUTE FUNCTION public.lp_set_updated_at();