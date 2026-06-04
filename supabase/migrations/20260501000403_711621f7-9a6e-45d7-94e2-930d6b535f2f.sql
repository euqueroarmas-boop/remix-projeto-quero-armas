
-- =====================================================================
-- FASE 1: SINCRONIZAÇÃO DE STATUS FINANCEIRO — FONTE ÚNICA qa_vendas
-- =====================================================================

-- 1) Tabela de auditoria de pagamentos
CREATE TABLE IF NOT EXISTS public.qa_pagamento_auditoria (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venda_id      integer,
  solicitacao_id uuid,
  cliente_id    integer,
  campo         text NOT NULL,
  valor_anterior text,
  valor_novo    text,
  origem        text NOT NULL CHECK (origem IN ('webhook_asaas','manual_financeiro','sistema_trigger','backfill','bloqueado','outro')),
  ator          text,
  contexto      jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qa_pag_audit_venda ON public.qa_pagamento_auditoria(venda_id);
CREATE INDEX IF NOT EXISTS idx_qa_pag_audit_solicitacao ON public.qa_pagamento_auditoria(solicitacao_id);
CREATE INDEX IF NOT EXISTS idx_qa_pag_audit_created ON public.qa_pagamento_auditoria(created_at DESC);

ALTER TABLE public.qa_pagamento_auditoria ENABLE ROW LEVEL SECURITY;

-- Apenas admins podem ler auditoria
DROP POLICY IF EXISTS "admin_read_pag_audit" ON public.qa_pagamento_auditoria;
CREATE POLICY "admin_read_pag_audit"
ON public.qa_pagamento_auditoria
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
  )
);

-- Insert apenas via service_role (triggers/edge functions). Sem policy de INSERT pra anon/authenticated.

-- =====================================================================
-- 2) Função utilitária: derivar status_financeiro a partir da venda
-- =====================================================================
CREATE OR REPLACE FUNCTION public.qa_derive_status_financeiro(
  p_status_venda text,
  p_valor_aberto numeric
) RETURNS text
LANGUAGE plpgsql IMMUTABLE
SET search_path = public
AS $$
DECLARE
  s text := lower(coalesce(p_status_venda, ''));
BEGIN
  IF s IN ('pago','quitado','recebido','confirmado') THEN RETURN 'pago'; END IF;
  IF s IN ('cancelado','cancelada','estornado','estornada') THEN RETURN 'cancelado'; END IF;
  IF s IN ('vencido','atrasado','inadimplente') THEN RETURN 'vencido'; END IF;
  IF coalesce(p_valor_aberto, 0) > 0 THEN RETURN 'pendente'; END IF;
  IF s = '' THEN RETURN 'pendente'; END IF;
  RETURN s;
END;
$$;

-- =====================================================================
-- 3) Trigger de PROPAGAÇÃO: qa_vendas → qa_solicitacoes_servico + qa_itens_venda
-- =====================================================================
CREATE OR REPLACE FUNCTION public.qa_vendas_propagate_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_novo_status_fin text;
  v_old_status_fin  text;
  r record;
  v_ator text;
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.status IS NOT DISTINCT FROM OLD.status
     AND NEW.valor_aberto IS NOT DISTINCT FROM OLD.valor_aberto THEN
    RETURN NEW;
  END IF;

  v_novo_status_fin := public.qa_derive_status_financeiro(NEW.status, NEW.valor_aberto);
  v_old_status_fin  := CASE WHEN TG_OP='UPDATE'
                            THEN public.qa_derive_status_financeiro(OLD.status, OLD.valor_aberto)
                            ELSE NULL END;

  v_ator := coalesce(current_setting('request.jwt.claim.email', true), session_user);

  -- Marca a sessão para a trigger de bloqueio permitir o update derivado
  PERFORM set_config('qa.allow_status_financeiro_update', '1', true);

  -- A) Propaga para solicitações vinculadas via venda_id
  FOR r IN
    SELECT id, status_financeiro, cliente_id
    FROM public.qa_solicitacoes_servico
    WHERE venda_id = NEW.id
      AND coalesce(status_financeiro,'') IS DISTINCT FROM v_novo_status_fin
  LOOP
    UPDATE public.qa_solicitacoes_servico
       SET status_financeiro = v_novo_status_fin,
           updated_at = now()
     WHERE id = r.id;

    INSERT INTO public.qa_pagamento_auditoria
      (venda_id, solicitacao_id, cliente_id, campo, valor_anterior, valor_novo, origem, ator, contexto)
    VALUES
      (NEW.id, r.id, r.cliente_id, 'status_financeiro',
       r.status_financeiro, v_novo_status_fin,
       'sistema_trigger', v_ator,
       jsonb_build_object('venda_status_old', OLD.status, 'venda_status_new', NEW.status,
                          'valor_aberto_old', OLD.valor_aberto, 'valor_aberto_new', NEW.valor_aberto));
  END LOOP;

  -- B) Propaga para solicitação vinculada via solicitacao_id (caso venda → solicitação)
  IF NEW.solicitacao_id IS NOT NULL THEN
    FOR r IN
      SELECT id, status_financeiro, cliente_id
      FROM public.qa_solicitacoes_servico
      WHERE id = NEW.solicitacao_id
        AND coalesce(status_financeiro,'') IS DISTINCT FROM v_novo_status_fin
    LOOP
      UPDATE public.qa_solicitacoes_servico
         SET status_financeiro = v_novo_status_fin,
             updated_at = now()
       WHERE id = r.id;

      INSERT INTO public.qa_pagamento_auditoria
        (venda_id, solicitacao_id, cliente_id, campo, valor_anterior, valor_novo, origem, ator, contexto)
      VALUES
        (NEW.id, r.id, r.cliente_id, 'status_financeiro',
         r.status_financeiro, v_novo_status_fin,
         'sistema_trigger', v_ator,
         jsonb_build_object('via','solicitacao_id'));
    END LOOP;
  END IF;

  -- C) Propaga para qa_itens_venda (se a tabela tiver coluna status)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='qa_itens_venda' AND column_name='status'
  ) THEN
    EXECUTE format(
      'UPDATE public.qa_itens_venda SET status = %L WHERE venda_id = %L AND coalesce(status,'''') IS DISTINCT FROM %L',
      v_novo_status_fin, NEW.id, v_novo_status_fin
    );
  END IF;

  -- Limpa o flag de sessão
  PERFORM set_config('qa.allow_status_financeiro_update', '0', true);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_qa_vendas_propagate_status ON public.qa_vendas;
CREATE TRIGGER trg_qa_vendas_propagate_status
AFTER INSERT OR UPDATE OF status, valor_aberto ON public.qa_vendas
FOR EACH ROW EXECUTE FUNCTION public.qa_vendas_propagate_status();

-- =====================================================================
-- 4) Trigger de BLOQUEIO: rejeita update direto em status_financeiro
-- =====================================================================
CREATE OR REPLACE FUNCTION public.qa_block_status_financeiro_direct()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_allowed text;
  v_ator text;
BEGIN
  IF NEW.status_financeiro IS NOT DISTINCT FROM OLD.status_financeiro THEN
    RETURN NEW;
  END IF;

  v_allowed := current_setting('qa.allow_status_financeiro_update', true);

  IF v_allowed = '1' THEN
    RETURN NEW; -- update vindo da trigger de propagação ou backfill
  END IF;

  v_ator := coalesce(current_setting('request.jwt.claim.email', true), session_user);

  -- Audita tentativa bloqueada
  INSERT INTO public.qa_pagamento_auditoria
    (venda_id, solicitacao_id, cliente_id, campo, valor_anterior, valor_novo, origem, ator, contexto)
  VALUES
    (NEW.venda_id, NEW.id, NEW.cliente_id, 'status_financeiro',
     OLD.status_financeiro, NEW.status_financeiro,
     'bloqueado', v_ator,
     jsonb_build_object('motivo','update_direto_proibido'));

  RAISE EXCEPTION
    'status_financeiro é DERIVADO de qa_vendas. Atualize via módulo financeiro (qa_vendas.status / valor_aberto). Tentativa bloqueada e auditada.'
    USING ERRCODE = 'check_violation';
END;
$$;

DROP TRIGGER IF EXISTS trg_qa_block_status_financeiro_direct ON public.qa_solicitacoes_servico;
CREATE TRIGGER trg_qa_block_status_financeiro_direct
BEFORE UPDATE OF status_financeiro ON public.qa_solicitacoes_servico
FOR EACH ROW EXECUTE FUNCTION public.qa_block_status_financeiro_direct();

-- =====================================================================
-- 5) BACKFILL: sincroniza tudo que está fora hoje
-- =====================================================================
DO $backfill$
DECLARE
  r record;
  v_novo text;
BEGIN
  PERFORM set_config('qa.allow_status_financeiro_update', '1', true);

  -- Via venda_id
  FOR r IN
    SELECT s.id AS sol_id, s.status_financeiro AS atual, s.cliente_id, v.id AS venda_id, v.status, v.valor_aberto
    FROM public.qa_solicitacoes_servico s
    JOIN public.qa_vendas v ON v.id = s.venda_id
  LOOP
    v_novo := public.qa_derive_status_financeiro(r.status, r.valor_aberto);
    IF coalesce(r.atual,'') IS DISTINCT FROM v_novo THEN
      UPDATE public.qa_solicitacoes_servico
         SET status_financeiro = v_novo, updated_at = now()
       WHERE id = r.sol_id;

      INSERT INTO public.qa_pagamento_auditoria
        (venda_id, solicitacao_id, cliente_id, campo, valor_anterior, valor_novo, origem, ator, contexto)
      VALUES
        (r.venda_id, r.sol_id, r.cliente_id, 'status_financeiro',
         r.atual, v_novo, 'backfill', 'system',
         jsonb_build_object('via','venda_id'));
    END IF;
  END LOOP;

  -- Via solicitacao_id
  FOR r IN
    SELECT s.id AS sol_id, s.status_financeiro AS atual, s.cliente_id, v.id AS venda_id, v.status, v.valor_aberto
    FROM public.qa_solicitacoes_servico s
    JOIN public.qa_vendas v ON v.solicitacao_id = s.id
    WHERE s.venda_id IS NULL
  LOOP
    v_novo := public.qa_derive_status_financeiro(r.status, r.valor_aberto);
    IF coalesce(r.atual,'') IS DISTINCT FROM v_novo THEN
      UPDATE public.qa_solicitacoes_servico
         SET status_financeiro = v_novo, updated_at = now()
       WHERE id = r.sol_id;

      INSERT INTO public.qa_pagamento_auditoria
        (venda_id, solicitacao_id, cliente_id, campo, valor_anterior, valor_novo, origem, ator, contexto)
      VALUES
        (r.venda_id, r.sol_id, r.cliente_id, 'status_financeiro',
         r.atual, v_novo, 'backfill', 'system',
         jsonb_build_object('via','solicitacao_id'));
    END IF;
  END LOOP;

  PERFORM set_config('qa.allow_status_financeiro_update', '0', true);
END;
$backfill$;

-- =====================================================================
-- 6) VIEW de divergências (monitoramento contínuo)
-- =====================================================================
CREATE OR REPLACE VIEW public.qa_status_divergencias AS
SELECT
  s.id            AS solicitacao_id,
  s.cliente_id,
  s.venda_id,
  s.status_financeiro AS status_solicitacao,
  v.status        AS status_venda,
  v.valor_aberto,
  public.qa_derive_status_financeiro(v.status, v.valor_aberto) AS status_esperado,
  s.updated_at    AS solicitacao_updated_at
FROM public.qa_solicitacoes_servico s
LEFT JOIN public.qa_vendas v
       ON v.id = s.venda_id OR v.solicitacao_id = s.id
WHERE v.id IS NOT NULL
  AND coalesce(s.status_financeiro,'') IS DISTINCT FROM public.qa_derive_status_financeiro(v.status, v.valor_aberto);
