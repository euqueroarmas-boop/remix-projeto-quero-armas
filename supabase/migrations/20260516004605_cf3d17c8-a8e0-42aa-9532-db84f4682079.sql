
-- =====================================================================
-- Funções auxiliares locais ao módulo de contratos
-- =====================================================================
CREATE OR REPLACE FUNCTION public.qa_contract_templates_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- =====================================================================
-- 1) qa_contract_templates
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.qa_contract_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL,
  versao integer NOT NULL,
  titulo text NOT NULL,
  corpo_html text NOT NULL,
  corpo_markdown text,
  variaveis jsonb DEFAULT '{}'::jsonb,
  vigente boolean DEFAULT false,
  data_publicacao timestamptz,
  observacoes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT qa_contract_templates_codigo_versao_uk UNIQUE (codigo, versao)
);

CREATE INDEX IF NOT EXISTS idx_qa_contract_templates_vigente
  ON public.qa_contract_templates (codigo)
  WHERE vigente = true;

ALTER TABLE public.qa_contract_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS qa_contract_templates_staff_all ON public.qa_contract_templates;
CREATE POLICY qa_contract_templates_staff_all
  ON public.qa_contract_templates
  FOR ALL TO authenticated
  USING (public.qa_is_active_staff(auth.uid()))
  WITH CHECK (public.qa_is_active_staff(auth.uid()));

DROP POLICY IF EXISTS qa_contract_templates_public_read_vigente ON public.qa_contract_templates;
CREATE POLICY qa_contract_templates_public_read_vigente
  ON public.qa_contract_templates
  FOR SELECT
  TO anon, authenticated
  USING (vigente = true);

DROP TRIGGER IF EXISTS trg_qa_contract_templates_updated ON public.qa_contract_templates;
CREATE TRIGGER trg_qa_contract_templates_updated
  BEFORE UPDATE ON public.qa_contract_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.qa_contract_templates_set_updated_at();

-- Vigência exclusiva por código.
CREATE OR REPLACE FUNCTION public.qa_contract_templates_enforce_vigente()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.vigente IS TRUE THEN
    UPDATE public.qa_contract_templates
      SET vigente = false, updated_at = now()
      WHERE codigo = NEW.codigo
        AND id <> NEW.id
        AND vigente = true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_qa_contract_templates_vigente ON public.qa_contract_templates;
CREATE TRIGGER trg_qa_contract_templates_vigente
  AFTER INSERT OR UPDATE OF vigente ON public.qa_contract_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.qa_contract_templates_enforce_vigente();

COMMENT ON TABLE public.qa_contract_templates IS
  'Templates versionados de contratos da Quero Armas. Cada (codigo, versao) é único. Apenas uma versão por codigo pode estar vigente (garantido por trigger). Versões antigas permanecem para fins probatórios. Variáveis dinâmicas substituídas em runtime: cliente_nome, cliente_cpf_cnpj, cliente_endereco, cliente_email, servico_slug, servico_nome, servico_preco, servico_anexo_i, aceite_data, aceite_ip, aceite_user_agent, aceite_hash.';

-- =====================================================================
-- 2) qa_contract_aceites_log (imutável: apenas SELECT/INSERT)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.qa_contract_aceites_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid REFERENCES public.qa_contracts(id) ON DELETE CASCADE,
  cliente_id integer,
  template_codigo text,
  template_versao integer,
  conteudo_hash text NOT NULL,
  aceite_data timestamptz NOT NULL DEFAULT now(),
  aceite_ip text,
  aceite_user_agent text,
  aceite_dispositivo jsonb,
  aceite_inicio_imediato boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qa_contract_aceites_log_contract
  ON public.qa_contract_aceites_log (contract_id);
CREATE INDEX IF NOT EXISTS idx_qa_contract_aceites_log_cliente
  ON public.qa_contract_aceites_log (cliente_id);

ALTER TABLE public.qa_contract_aceites_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS qa_contract_aceites_log_staff_select ON public.qa_contract_aceites_log;
CREATE POLICY qa_contract_aceites_log_staff_select
  ON public.qa_contract_aceites_log
  FOR SELECT TO authenticated
  USING (public.qa_is_active_staff(auth.uid()));

DROP POLICY IF EXISTS qa_contract_aceites_log_staff_insert ON public.qa_contract_aceites_log;
CREATE POLICY qa_contract_aceites_log_staff_insert
  ON public.qa_contract_aceites_log
  FOR INSERT TO authenticated
  WITH CHECK (public.qa_is_active_staff(auth.uid()));

DROP POLICY IF EXISTS qa_contract_aceites_log_owner_select ON public.qa_contract_aceites_log;
CREATE POLICY qa_contract_aceites_log_owner_select
  ON public.qa_contract_aceites_log
  FOR SELECT TO authenticated
  USING (
    cliente_id IN (
      SELECT qa_cliente_id FROM public.cliente_auth_links WHERE user_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public.qa_contract_aceites_log_block_mutations()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'qa_contract_aceites_log é imutável (log probatório). Operações UPDATE/DELETE são proibidas.';
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_qa_contract_aceites_log_no_update ON public.qa_contract_aceites_log;
CREATE TRIGGER trg_qa_contract_aceites_log_no_update
  BEFORE UPDATE ON public.qa_contract_aceites_log
  FOR EACH ROW
  EXECUTE FUNCTION public.qa_contract_aceites_log_block_mutations();

DROP TRIGGER IF EXISTS trg_qa_contract_aceites_log_no_delete ON public.qa_contract_aceites_log;
CREATE TRIGGER trg_qa_contract_aceites_log_no_delete
  BEFORE DELETE ON public.qa_contract_aceites_log
  FOR EACH ROW
  EXECUTE FUNCTION public.qa_contract_aceites_log_block_mutations();

COMMENT ON TABLE public.qa_contract_aceites_log IS
  'Log imutável (append-only) de aceites eletrônicos de contratos. Conforme MP 2.200-2/2001 e Lei 14.063/2020. UPDATE e DELETE bloqueados por trigger. Excluído em cascata somente se o qa_contracts referenciado for excluído.';

-- =====================================================================
-- 3) ALTER qa_contracts - colunas aditivas (todas NULLABLE)
--    Pipeline PDF + ICP-Brasil canônico permanece INTACTO.
-- =====================================================================
ALTER TABLE public.qa_contracts ADD COLUMN IF NOT EXISTS template_id uuid REFERENCES public.qa_contract_templates(id);
ALTER TABLE public.qa_contracts ADD COLUMN IF NOT EXISTS template_codigo text;
ALTER TABLE public.qa_contracts ADD COLUMN IF NOT EXISTS template_versao integer;
ALTER TABLE public.qa_contracts ADD COLUMN IF NOT EXISTS conteudo_renderizado text;
ALTER TABLE public.qa_contracts ADD COLUMN IF NOT EXISTS servico_slug text;
ALTER TABLE public.qa_contracts ADD COLUMN IF NOT EXISTS valor numeric(10,2);
ALTER TABLE public.qa_contracts ADD COLUMN IF NOT EXISTS aceite_eletronico_data timestamptz;
ALTER TABLE public.qa_contracts ADD COLUMN IF NOT EXISTS aceite_ip text;
ALTER TABLE public.qa_contracts ADD COLUMN IF NOT EXISTS aceite_user_agent text;
ALTER TABLE public.qa_contracts ADD COLUMN IF NOT EXISTS aceite_hash text;
ALTER TABLE public.qa_contracts ADD COLUMN IF NOT EXISTS aceite_inicio_imediato boolean DEFAULT false;

COMMENT ON COLUMN public.qa_contracts.conteudo_renderizado IS
  'Snapshot imutável do contrato (HTML) com variáveis dinâmicas já substituídas no momento do aceite eletrônico.';
COMMENT ON COLUMN public.qa_contracts.aceite_hash IS
  'SHA-256 de (conteudo_renderizado || aceite_eletronico_data || cliente_id). Permite verificação posterior da integridade.';
