
-- =========================================================
-- FASE 16-A — qa_vendas hardening + qa_venda_eventos + RPCs
-- Não-destrutivo. Nenhum dado existente é alterado.
-- =========================================================

-- 1) Colunas opcionais em qa_vendas (sem CHECK, sem default forte)
ALTER TABLE public.qa_vendas
  ADD COLUMN IF NOT EXISTS valor_informado_cliente numeric,
  ADD COLUMN IF NOT EXISTS valor_aprovado numeric,
  ADD COLUMN IF NOT EXISTS status_validacao_valor text,
  ADD COLUMN IF NOT EXISTS aprovado_por uuid,
  ADD COLUMN IF NOT EXISTS aprovado_em timestamptz,
  ADD COLUMN IF NOT EXISTS motivo_correcao text,
  ADD COLUMN IF NOT EXISTS origem_proposta text,
  ADD COLUMN IF NOT EXISTS validacao_valor_atualizado_em timestamptz;

COMMENT ON COLUMN public.qa_vendas.valor_informado_cliente IS 'Fase 16-A: valor combinado informado pelo cliente (proposta).';
COMMENT ON COLUMN public.qa_vendas.valor_aprovado          IS 'Fase 16-A: valor oficializado pela Equipe Operacional.';
COMMENT ON COLUMN public.qa_vendas.status_validacao_valor  IS 'Fase 16-A: aguardando_validacao | corrigido | aprovado | reprovado. Sem CHECK por compatibilidade legada.';

-- 2) Tabela de eventos imutáveis de venda
CREATE TABLE IF NOT EXISTS public.qa_venda_eventos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venda_id        integer NOT NULL REFERENCES public.qa_vendas(id) ON DELETE CASCADE,
  cliente_id      integer,                    -- id_legado, igual a qa_vendas.cliente_id
  qa_cliente_id   integer,                    -- id real de qa_clientes (resolvido na inserção)
  tipo_evento     text NOT NULL,
  descricao       text,
  dados_json      jsonb NOT NULL DEFAULT '{}'::jsonb,
  ator            text,                       -- 'cliente' | 'equipe_operacional' | 'sistema'
  user_id         uuid,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qa_venda_eventos_venda      ON public.qa_venda_eventos(venda_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_qa_venda_eventos_cliente    ON public.qa_venda_eventos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_qa_venda_eventos_qa_cliente ON public.qa_venda_eventos(qa_cliente_id);
CREATE INDEX IF NOT EXISTS idx_qa_venda_eventos_tipo       ON public.qa_venda_eventos(tipo_evento);

ALTER TABLE public.qa_venda_eventos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS qa_venda_eventos_staff_select ON public.qa_venda_eventos;
CREATE POLICY qa_venda_eventos_staff_select ON public.qa_venda_eventos
  FOR SELECT TO authenticated
  USING (public.qa_is_active_staff(auth.uid()));

DROP POLICY IF EXISTS qa_venda_eventos_owner_select ON public.qa_venda_eventos;
CREATE POLICY qa_venda_eventos_owner_select ON public.qa_venda_eventos
  FOR SELECT TO authenticated
  USING (
    qa_cliente_id IS NOT NULL
    AND qa_cliente_id = public.qa_current_cliente_id(auth.uid())
  );

-- INSERT: somente staff direto. Cliente insere via RPC SECURITY DEFINER (qa_venda_propor_valor).
DROP POLICY IF EXISTS qa_venda_eventos_staff_insert ON public.qa_venda_eventos;
CREATE POLICY qa_venda_eventos_staff_insert ON public.qa_venda_eventos
  FOR INSERT TO authenticated
  WITH CHECK (public.qa_is_active_staff(auth.uid()));

-- Trigger de imutabilidade
CREATE OR REPLACE FUNCTION public.qa_venda_eventos_imutavel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'qa_venda_eventos é imutável (UPDATE bloqueado).';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'qa_venda_eventos é imutável (DELETE bloqueado).';
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_qa_venda_eventos_imutavel_upd ON public.qa_venda_eventos;
CREATE TRIGGER trg_qa_venda_eventos_imutavel_upd
  BEFORE UPDATE ON public.qa_venda_eventos
  FOR EACH ROW EXECUTE FUNCTION public.qa_venda_eventos_imutavel();

DROP TRIGGER IF EXISTS trg_qa_venda_eventos_imutavel_del ON public.qa_venda_eventos;
CREATE TRIGGER trg_qa_venda_eventos_imutavel_del
  BEFORE DELETE ON public.qa_venda_eventos
  FOR EACH ROW EXECUTE FUNCTION public.qa_venda_eventos_imutavel();

-- =========================================================
-- 3) Helper: resolver qa_cliente_id real a partir de id_legado
-- =========================================================
CREATE OR REPLACE FUNCTION public.qa_resolve_cliente_id_real(p_cliente_id_legado integer)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.qa_clientes WHERE id_legado = p_cliente_id_legado LIMIT 1
$$;

-- =========================================================
-- 4) RPC: propor valor (cliente dono ou staff)
-- =========================================================
CREATE OR REPLACE FUNCTION public.qa_venda_propor_valor(
  p_venda_id integer,
  p_valor    numeric,
  p_origem   text DEFAULT 'cliente'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid     uuid := auth.uid();
  v_is_staff boolean := public.qa_is_active_staff(v_uid);
  v_owner_id integer := public.qa_current_cliente_id(v_uid);
  v_venda    public.qa_vendas%ROWTYPE;
  v_cli_real integer;
  v_dup      boolean := false;
  v_ator     text;
BEGIN
  IF p_venda_id IS NULL OR p_valor IS NULL THEN
    RAISE EXCEPTION 'p_venda_id e p_valor são obrigatórios';
  END IF;
  IF p_valor < 0 THEN
    RAISE EXCEPTION 'Valor não pode ser negativo';
  END IF;

  SELECT * INTO v_venda FROM public.qa_vendas WHERE id = p_venda_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Venda % não encontrada', p_venda_id;
  END IF;

  v_cli_real := public.qa_resolve_cliente_id_real(v_venda.cliente_id);

  -- Autorização: staff OU dono da venda
  IF NOT v_is_staff THEN
    IF v_owner_id IS NULL OR v_owner_id <> v_cli_real THEN
      RAISE EXCEPTION 'Não autorizado a propor valor nesta venda.';
    END IF;
    v_ator := 'cliente';
  ELSE
    v_ator := 'equipe_operacional';
  END IF;

  -- Idempotência: mesmo valor + status já aguardando_validacao → não duplicar
  IF v_venda.valor_informado_cliente IS NOT DISTINCT FROM p_valor
     AND v_venda.status_validacao_valor = 'aguardando_validacao' THEN
    v_dup := true;
  ELSE
    UPDATE public.qa_vendas
       SET valor_informado_cliente = p_valor,
           status_validacao_valor  = 'aguardando_validacao',
           origem_proposta         = COALESCE(p_origem, v_ator),
           validacao_valor_atualizado_em = now()
     WHERE id = p_venda_id;

    INSERT INTO public.qa_venda_eventos (
      venda_id, cliente_id, qa_cliente_id, tipo_evento, descricao, dados_json, ator, user_id
    ) VALUES (
      p_venda_id, v_venda.cliente_id, v_cli_real,
      'valor_informado',
      format('Valor proposto: R$ %s (origem=%s)', p_valor::text, COALESCE(p_origem, v_ator)),
      jsonb_build_object('valor', p_valor, 'origem', COALESCE(p_origem, v_ator)),
      v_ator, v_uid
    );
  END IF;

  RETURN jsonb_build_object(
    'venda_id', p_venda_id,
    'valor_informado_cliente', p_valor,
    'status_validacao_valor', 'aguardando_validacao',
    'evento_duplicado_ignorado', v_dup
  );
END;
$$;

-- =========================================================
-- 5) RPC: corrigir valor (apenas staff)
-- =========================================================
CREATE OR REPLACE FUNCTION public.qa_venda_corrigir_valor(
  p_venda_id        integer,
  p_valor_corrigido numeric,
  p_motivo          text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_venda  public.qa_vendas%ROWTYPE;
  v_dup    boolean := false;
  v_cli_real integer;
BEGIN
  IF NOT public.qa_is_active_staff(v_uid) THEN
    RAISE EXCEPTION 'Apenas Equipe Operacional pode corrigir valor.';
  END IF;
  IF p_venda_id IS NULL OR p_valor_corrigido IS NULL THEN
    RAISE EXCEPTION 'p_venda_id e p_valor_corrigido são obrigatórios';
  END IF;
  IF p_motivo IS NULL OR length(btrim(p_motivo)) < 3 THEN
    RAISE EXCEPTION 'Motivo é obrigatório (mínimo 3 caracteres).';
  END IF;
  IF p_valor_corrigido < 0 THEN
    RAISE EXCEPTION 'Valor não pode ser negativo';
  END IF;

  SELECT * INTO v_venda FROM public.qa_vendas WHERE id = p_venda_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Venda % não encontrada', p_venda_id;
  END IF;

  v_cli_real := public.qa_resolve_cliente_id_real(v_venda.cliente_id);

  -- Idempotência: mesmo valor + mesmo motivo + status corrigido → não duplicar
  IF v_venda.valor_aprovado IS NOT DISTINCT FROM p_valor_corrigido
     AND v_venda.motivo_correcao IS NOT DISTINCT FROM btrim(p_motivo)
     AND v_venda.status_validacao_valor = 'corrigido' THEN
    v_dup := true;
  ELSE
    UPDATE public.qa_vendas
       SET valor_aprovado          = p_valor_corrigido,
           motivo_correcao         = btrim(p_motivo),
           status_validacao_valor  = 'corrigido',
           validacao_valor_atualizado_em = now()
     WHERE id = p_venda_id;

    INSERT INTO public.qa_venda_eventos (
      venda_id, cliente_id, qa_cliente_id, tipo_evento, descricao, dados_json, ator, user_id
    ) VALUES (
      p_venda_id, v_venda.cliente_id, v_cli_real,
      'valor_corrigido',
      format('Valor corrigido para R$ %s. Motivo: %s', p_valor_corrigido::text, btrim(p_motivo)),
      jsonb_build_object(
        'valor_corrigido', p_valor_corrigido,
        'valor_anterior_informado', v_venda.valor_informado_cliente,
        'motivo', btrim(p_motivo)
      ),
      'equipe_operacional', v_uid
    );
  END IF;

  RETURN jsonb_build_object(
    'venda_id', p_venda_id,
    'valor_aprovado', p_valor_corrigido,
    'status_validacao_valor', 'corrigido',
    'evento_duplicado_ignorado', v_dup
  );
END;
$$;

-- =========================================================
-- 6) RPC: aprovar valor (apenas staff)
-- =========================================================
CREATE OR REPLACE FUNCTION public.qa_venda_aprovar_valor(p_venda_id integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid     uuid := auth.uid();
  v_venda   public.qa_vendas%ROWTYPE;
  v_valor   numeric;
  v_dup     boolean := false;
  v_cli_real integer;
BEGIN
  IF NOT public.qa_is_active_staff(v_uid) THEN
    RAISE EXCEPTION 'Apenas Equipe Operacional pode aprovar valor.';
  END IF;
  IF p_venda_id IS NULL THEN
    RAISE EXCEPTION 'p_venda_id é obrigatório';
  END IF;

  SELECT * INTO v_venda FROM public.qa_vendas WHERE id = p_venda_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Venda % não encontrada', p_venda_id;
  END IF;

  v_valor := COALESCE(v_venda.valor_aprovado, v_venda.valor_informado_cliente);
  IF v_valor IS NULL THEN
    RAISE EXCEPTION 'Não há valor proposto nem corrigido nesta venda. Use propor_valor antes.';
  END IF;

  v_cli_real := public.qa_resolve_cliente_id_real(v_venda.cliente_id);

  -- Idempotência: já aprovado com mesmo valor → não duplicar
  IF v_venda.status_validacao_valor = 'aprovado'
     AND v_venda.valor_aprovado IS NOT DISTINCT FROM v_valor THEN
    v_dup := true;
  ELSE
    UPDATE public.qa_vendas
       SET valor_aprovado          = v_valor,
           status_validacao_valor  = 'aprovado',
           aprovado_por            = v_uid,
           aprovado_em             = now(),
           validacao_valor_atualizado_em = now()
     WHERE id = p_venda_id;

    INSERT INTO public.qa_venda_eventos (
      venda_id, cliente_id, qa_cliente_id, tipo_evento, descricao, dados_json, ator, user_id
    ) VALUES (
      p_venda_id, v_venda.cliente_id, v_cli_real,
      'valor_aprovado',
      format('Valor aprovado: R$ %s', v_valor::text),
      jsonb_build_object('valor_aprovado', v_valor),
      'equipe_operacional', v_uid
    );
  END IF;

  RETURN jsonb_build_object(
    'venda_id', p_venda_id,
    'valor_aprovado', v_valor,
    'status_validacao_valor', 'aprovado',
    'aprovado_por', v_uid,
    'evento_duplicado_ignorado', v_dup
  );
END;
$$;

-- =========================================================
-- 7) RPC: reprovar valor (apenas staff)
-- =========================================================
CREATE OR REPLACE FUNCTION public.qa_venda_reprovar_valor(
  p_venda_id integer,
  p_motivo   text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_venda  public.qa_vendas%ROWTYPE;
  v_dup    boolean := false;
  v_cli_real integer;
BEGIN
  IF NOT public.qa_is_active_staff(v_uid) THEN
    RAISE EXCEPTION 'Apenas Equipe Operacional pode reprovar valor.';
  END IF;
  IF p_venda_id IS NULL THEN
    RAISE EXCEPTION 'p_venda_id é obrigatório';
  END IF;
  IF p_motivo IS NULL OR length(btrim(p_motivo)) < 3 THEN
    RAISE EXCEPTION 'Motivo é obrigatório (mínimo 3 caracteres).';
  END IF;

  SELECT * INTO v_venda FROM public.qa_vendas WHERE id = p_venda_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Venda % não encontrada', p_venda_id;
  END IF;

  v_cli_real := public.qa_resolve_cliente_id_real(v_venda.cliente_id);

  IF v_venda.status_validacao_valor = 'reprovado'
     AND v_venda.motivo_correcao IS NOT DISTINCT FROM btrim(p_motivo) THEN
    v_dup := true;
  ELSE
    UPDATE public.qa_vendas
       SET status_validacao_valor  = 'reprovado',
           motivo_correcao         = btrim(p_motivo),
           validacao_valor_atualizado_em = now()
     WHERE id = p_venda_id;

    INSERT INTO public.qa_venda_eventos (
      venda_id, cliente_id, qa_cliente_id, tipo_evento, descricao, dados_json, ator, user_id
    ) VALUES (
      p_venda_id, v_venda.cliente_id, v_cli_real,
      'valor_reprovado',
      format('Valor reprovado. Motivo: %s', btrim(p_motivo)),
      jsonb_build_object('motivo', btrim(p_motivo)),
      'equipe_operacional', v_uid
    );
  END IF;

  RETURN jsonb_build_object(
    'venda_id', p_venda_id,
    'status_validacao_valor', 'reprovado',
    'evento_duplicado_ignorado', v_dup
  );
END;
$$;

-- Permissões de execução
GRANT EXECUTE ON FUNCTION public.qa_venda_propor_valor(integer, numeric, text)   TO authenticated;
GRANT EXECUTE ON FUNCTION public.qa_venda_corrigir_valor(integer, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.qa_venda_aprovar_valor(integer)                 TO authenticated;
GRANT EXECUTE ON FUNCTION public.qa_venda_reprovar_valor(integer, text)          TO authenticated;
GRANT EXECUTE ON FUNCTION public.qa_resolve_cliente_id_real(integer)             TO authenticated;
