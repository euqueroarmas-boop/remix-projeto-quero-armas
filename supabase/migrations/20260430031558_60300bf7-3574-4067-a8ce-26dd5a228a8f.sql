
ALTER TABLE public.qa_clientes
  ADD COLUMN IF NOT EXISTS cliente_legado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS homologacao_status text NOT NULL DEFAULT 'nao_aplicavel',
  ADD COLUMN IF NOT EXISTS homologado_em timestamptz NULL,
  ADD COLUMN IF NOT EXISTS homologado_por uuid NULL,
  ADD COLUMN IF NOT EXISTS homologacao_observacoes text NULL,
  ADD COLUMN IF NOT EXISTS recadastramento_obrigatorio boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recadastramento_status text NULL,
  ADD COLUMN IF NOT EXISTS recadastramento_iniciado_em timestamptz NULL,
  ADD COLUMN IF NOT EXISTS recadastramento_concluido_em timestamptz NULL,
  ADD COLUMN IF NOT EXISTS tentativa_compra_legado_em timestamptz NULL,
  ADD COLUMN IF NOT EXISTS tentativa_compra_legado_count integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.qa_clientes.cliente_legado IS
  'Cliente importado do sistema antigo (Access). Bloqueia compra direta até homologar.';
COMMENT ON COLUMN public.qa_clientes.homologacao_status IS
  'nao_aplicavel | pendente | em_revisao | aguardando_documentos | documentos_enviados | homologado | reprovado | arquivado';
COMMENT ON COLUMN public.qa_clientes.recadastramento_status IS
  'aguardando_inicio | em_andamento | aguardando_aprovacao | aprovado | reprovado';

CREATE INDEX IF NOT EXISTS idx_qa_clientes_homologacao_status
  ON public.qa_clientes (homologacao_status)
  WHERE COALESCE(excluido,false) = false;

CREATE INDEX IF NOT EXISTS idx_qa_clientes_cliente_legado
  ON public.qa_clientes (cliente_legado)
  WHERE COALESCE(excluido,false) = false;

CREATE INDEX IF NOT EXISTS idx_qa_clientes_recadastramento_obr
  ON public.qa_clientes (recadastramento_obrigatorio)
  WHERE recadastramento_obrigatorio = true AND COALESCE(excluido,false) = false;

CREATE TABLE IF NOT EXISTS public.qa_cliente_homologacao_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  qa_cliente_id integer NOT NULL REFERENCES public.qa_clientes(id) ON DELETE RESTRICT,
  tipo_evento text NOT NULL,
  descricao text NULL,
  dados_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  ator text NOT NULL DEFAULT 'sistema',
  user_id uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qa_homol_eventos_cliente
  ON public.qa_cliente_homologacao_eventos (qa_cliente_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_qa_homol_eventos_tipo
  ON public.qa_cliente_homologacao_eventos (tipo_evento, created_at DESC);

ALTER TABLE public.qa_cliente_homologacao_eventos ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.qa_homol_eventos_imutavel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RAISE EXCEPTION 'qa_cliente_homologacao_eventos é imutável (acao=%).', TG_OP;
END;
$$;

DROP TRIGGER IF EXISTS trg_qa_homol_eventos_no_update ON public.qa_cliente_homologacao_eventos;
CREATE TRIGGER trg_qa_homol_eventos_no_update
BEFORE UPDATE ON public.qa_cliente_homologacao_eventos
FOR EACH ROW EXECUTE FUNCTION public.qa_homol_eventos_imutavel();

DROP TRIGGER IF EXISTS trg_qa_homol_eventos_no_delete ON public.qa_cliente_homologacao_eventos;
CREATE TRIGGER trg_qa_homol_eventos_no_delete
BEFORE DELETE ON public.qa_cliente_homologacao_eventos
FOR EACH ROW EXECUTE FUNCTION public.qa_homol_eventos_imutavel();

DROP POLICY IF EXISTS "qa_homol_eventos_staff_select" ON public.qa_cliente_homologacao_eventos;
CREATE POLICY "qa_homol_eventos_staff_select"
ON public.qa_cliente_homologacao_eventos
FOR SELECT
TO authenticated
USING (public.qa_is_active_staff(auth.uid()));

DROP POLICY IF EXISTS "qa_homol_eventos_staff_insert" ON public.qa_cliente_homologacao_eventos;
CREATE POLICY "qa_homol_eventos_staff_insert"
ON public.qa_cliente_homologacao_eventos
FOR INSERT
TO authenticated
WITH CHECK (public.qa_is_active_staff(auth.uid()));

DROP POLICY IF EXISTS "qa_homol_eventos_cliente_select_proprio" ON public.qa_cliente_homologacao_eventos;
CREATE POLICY "qa_homol_eventos_cliente_select_proprio"
ON public.qa_cliente_homologacao_eventos
FOR SELECT
TO authenticated
USING (qa_cliente_id = public.qa_current_cliente_id(auth.uid()));

DROP VIEW IF EXISTS public.qa_clientes_homologacao_kpis;
DROP VIEW IF EXISTS public.qa_clientes_homologacao_dry_run;

CREATE VIEW public.qa_clientes_homologacao_dry_run AS
WITH ativos AS (
  SELECT * FROM public.qa_clientes WHERE COALESCE(excluido,false) = false
),
dup_cpf AS (
  SELECT cpf FROM ativos
  WHERE cpf IS NOT NULL AND btrim(cpf)<>''
  GROUP BY cpf HAVING COUNT(*)>1
),
dup_email AS (
  SELECT lower(btrim(email)) AS e FROM ativos
  WHERE email IS NOT NULL AND btrim(email)<>''
  GROUP BY lower(btrim(email)) HAVING COUNT(*)>1
),
flags AS (
  SELECT a.id AS cliente_id,
    a.id_legado, a.nome_completo, a.cpf, a.email, a.celular,
    a.tipo_cliente, a.origem, a.user_id,
    a.cliente_legado AS cliente_legado_atual,
    a.homologacao_status AS homologacao_status_atual,
    EXISTS (SELECT 1 FROM public.qa_vendas v WHERE v.cliente_id = a.id) AS tem_venda_antiga,
    EXISTS (SELECT 1 FROM public.qa_cliente_armas_manual am WHERE am.qa_cliente_id = a.id) AS tem_arma_manual,
    EXISTS (SELECT 1 FROM public.qa_crafs cr WHERE cr.cliente_id = a.id) AS tem_craf,
    EXISTS (SELECT 1 FROM public.qa_documentos_cliente dc WHERE dc.qa_cliente_id = a.id) AS tem_documento_cliente,
    (a.tentativa_compra_legado_count > 0) AS tentou_comprar,
    (a.cpf IS NULL OR btrim(a.cpf) = '') AS sem_cpf,
    (a.cpf IN (SELECT cpf FROM dup_cpf)) AS cpf_duplicado,
    (lower(btrim(a.email)) IN (SELECT e FROM dup_email)) AS email_duplicado
  FROM ativos a
)
SELECT
  f.*,
  CASE
    WHEN f.tipo_cliente = 'cliente_app' THEN 'cliente_app_novo'
    WHEN f.user_id IS NOT NULL AND f.tipo_cliente <> 'cliente_app' THEN 'cliente_novo_com_portal'
    WHEN f.sem_cpf OR f.cpf_duplicado OR f.email_duplicado THEN 'revisar_manual'
    WHEN f.tipo_cliente <> 'cliente_app' AND f.user_id IS NULL THEN 'legado_pendente'
    ELSE 'revisar_manual'
  END AS classificacao_sugerida,
  CASE
    WHEN f.tipo_cliente = 'cliente_app' THEN 'tipo_cliente=cliente_app'
    WHEN f.user_id IS NOT NULL THEN 'possui user_id no portal novo'
    WHEN f.sem_cpf THEN 'sem CPF'
    WHEN f.cpf_duplicado THEN 'CPF duplicado'
    WHEN f.email_duplicado THEN 'e-mail duplicado'
    WHEN f.tipo_cliente <> 'cliente_app' AND f.user_id IS NULL THEN 'sem user_id e tipo_cliente operacional'
    ELSE 'criterio_residual'
  END AS motivo_classificacao,
  CASE
    WHEN f.tentou_comprar THEN 1
    WHEN f.tem_documento_cliente THEN 2
    WHEN f.tem_craf THEN 3
    WHEN f.tem_venda_antiga THEN 4
    WHEN f.cpf IS NOT NULL AND (f.email IS NOT NULL OR f.celular IS NOT NULL) THEN 5
    ELSE 9
  END AS prioridade_homologacao
FROM flags f;

COMMENT ON VIEW public.qa_clientes_homologacao_dry_run IS
  'Fase 20-B: classificação sugerida sem alterar dados. Backfill ainda não executado.';

CREATE VIEW public.qa_clientes_homologacao_kpis AS
WITH base AS (SELECT * FROM public.qa_clientes_homologacao_dry_run),
agg AS (
  SELECT
    COUNT(*)::int AS total_clientes,
    COUNT(*) FILTER (WHERE classificacao_sugerida='cliente_app_novo')::int AS total_cliente_app,
    COUNT(*) FILTER (WHERE classificacao_sugerida='cliente_novo_com_portal')::int AS total_novos_com_portal,
    COUNT(*) FILTER (WHERE classificacao_sugerida='legado_pendente')::int AS total_legado_pendente,
    COUNT(*) FILTER (WHERE classificacao_sugerida='revisar_manual')::int AS total_revisar_manual,
    COUNT(*) FILTER (WHERE homologacao_status_atual='homologado')::int AS total_homologado,
    COUNT(*) FILTER (WHERE homologacao_status_atual='em_revisao')::int AS total_em_revisao,
    COUNT(*) FILTER (WHERE homologacao_status_atual='aguardando_documentos')::int AS total_aguardando_documentos,
    COUNT(*) FILTER (WHERE homologacao_status_atual='documentos_enviados')::int AS total_documentos_enviados,
    COUNT(*) FILTER (WHERE cliente_legado_atual = true)::int AS total_marcados_legado,
    COUNT(*) FILTER (WHERE tentou_comprar = true)::int AS total_tentaram_comprar
  FROM base
)
SELECT
  a.*,
  GREATEST(a.total_legado_pendente - a.total_homologado, 0) AS faltam_homologar,
  GREATEST(a.total_legado_pendente - a.total_homologado, 0) AS meta_1_por_dia_dias_restantes
FROM agg a;

COMMENT ON VIEW public.qa_clientes_homologacao_kpis IS
  'Fase 20-B: KPIs do painel de homologação. Faltam_homologar baseia-se no dry-run.';

GRANT SELECT ON public.qa_clientes_homologacao_dry_run TO authenticated;
GRANT SELECT ON public.qa_clientes_homologacao_kpis TO authenticated;
