-- =========================================================================
-- FASE 18-A: Conta Arsenal automática (free → premium via qa_vendas)
-- =========================================================================

-- 1) Adicionar colunas arsenal_* em qa_clientes (idempotente)
ALTER TABLE public.qa_clientes
  ADD COLUMN IF NOT EXISTS arsenal_plano text NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS arsenal_status text NOT NULL DEFAULT 'ativo',
  ADD COLUMN IF NOT EXISTS arsenal_upgrade_em timestamptz,
  ADD COLUMN IF NOT EXISTS arsenal_ultimo_acesso_em timestamptz;

-- Constraints
DO $$ BEGIN
  ALTER TABLE public.qa_clientes
    ADD CONSTRAINT qa_clientes_arsenal_plano_chk
    CHECK (arsenal_plano IN ('free', 'premium'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.qa_clientes
    ADD CONSTRAINT qa_clientes_arsenal_status_chk
    CHECK (arsenal_status IN ('ativo', 'suspenso', 'cancelado'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_qa_clientes_arsenal_plano
  ON public.qa_clientes(arsenal_plano);

-- 2) Tabela de notificações in-app do Arsenal
CREATE TABLE IF NOT EXISTS public.qa_arsenal_notificacoes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id integer NOT NULL REFERENCES public.qa_clientes(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  titulo text NOT NULL,
  mensagem text NOT NULL,
  link text,
  icone text,
  lida boolean NOT NULL DEFAULT false,
  lida_em timestamptz,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qa_arsenal_notif_cliente
  ON public.qa_arsenal_notificacoes(cliente_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_qa_arsenal_notif_lida
  ON public.qa_arsenal_notificacoes(cliente_id, lida) WHERE lida = false;

ALTER TABLE public.qa_arsenal_notificacoes ENABLE ROW LEVEL SECURITY;

-- Policy: cliente vê apenas suas próprias notificações (via cliente_auth_links)
DROP POLICY IF EXISTS "Cliente vê suas notificações Arsenal" ON public.qa_arsenal_notificacoes;
CREATE POLICY "Cliente vê suas notificações Arsenal"
  ON public.qa_arsenal_notificacoes FOR SELECT
  TO authenticated
  USING (
    cliente_id IN (
      SELECT qa_cliente_id FROM public.cliente_auth_links
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- Policy: cliente pode marcar como lida
DROP POLICY IF EXISTS "Cliente marca notificação como lida" ON public.qa_arsenal_notificacoes;
CREATE POLICY "Cliente marca notificação como lida"
  ON public.qa_arsenal_notificacoes FOR UPDATE
  TO authenticated
  USING (
    cliente_id IN (
      SELECT qa_cliente_id FROM public.cliente_auth_links
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- 3) Função idempotente que faz upgrade quando venda vira PAGO
CREATE OR REPLACE FUNCTION public.qa_arsenal_processar_pagamento_venda(p_venda_id integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cliente_id_legado integer;
  v_cliente_id integer;
  v_plano_atual text;
  v_nome text;
  v_notif_id uuid;
BEGIN
  -- Busca a venda e o cliente vinculado
  SELECT v.cliente_id INTO v_cliente_id_legado
  FROM public.qa_vendas v
  WHERE v.id = p_venda_id;

  IF v_cliente_id_legado IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'venda_sem_cliente');
  END IF;

  -- Resolve cliente real via id_legado (qa_vendas.cliente_id referencia id_legado)
  SELECT c.id, c.arsenal_plano, c.nome_completo
    INTO v_cliente_id, v_plano_atual, v_nome
  FROM public.qa_clientes c
  WHERE c.id_legado = v_cliente_id_legado
  LIMIT 1;

  IF v_cliente_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'cliente_nao_encontrado');
  END IF;

  -- Idempotência: se já é premium, não faz nada
  IF v_plano_atual = 'premium' THEN
    RETURN jsonb_build_object('ok', true, 'skipped', true, 'reason', 'ja_premium', 'cliente_id', v_cliente_id);
  END IF;

  -- Faz upgrade
  UPDATE public.qa_clientes
  SET
    arsenal_plano = 'premium',
    arsenal_upgrade_em = now(),
    arsenal_status = 'ativo'
  WHERE id = v_cliente_id;

  -- Cria notificação in-app
  INSERT INTO public.qa_arsenal_notificacoes (
    cliente_id, tipo, titulo, mensagem, link, icone, metadata
  ) VALUES (
    v_cliente_id,
    'upgrade_premium',
    'Seu Arsenal Premium foi liberado!',
    'O pagamento foi confirmado. Agora você tem acesso a todas as funcionalidades do app Arsenal.',
    '/area-do-cliente',
    'crown',
    jsonb_build_object('venda_id', p_venda_id, 'upgrade_em', now())
  )
  RETURNING id INTO v_notif_id;

  RETURN jsonb_build_object(
    'ok', true,
    'cliente_id', v_cliente_id,
    'notif_id', v_notif_id,
    'venda_id', p_venda_id
  );
END;
$$;

-- 4) Trigger: dispara o upgrade quando qa_vendas.status vira PAGO
CREATE OR REPLACE FUNCTION public.qa_vendas_arsenal_upgrade_trg()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_status text;
  v_new_status text;
BEGIN
  v_new_status := upper(btrim(COALESCE(NEW.status, '')));
  v_old_status := upper(btrim(COALESCE(OLD.status, '')));

  -- Só dispara em transição para PAGO
  IF v_new_status = 'PAGO' AND v_old_status <> 'PAGO' THEN
    PERFORM public.qa_arsenal_processar_pagamento_venda(NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_qa_vendas_arsenal_upgrade ON public.qa_vendas;
CREATE TRIGGER trg_qa_vendas_arsenal_upgrade
  AFTER UPDATE OF status ON public.qa_vendas
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.qa_vendas_arsenal_upgrade_trg();

-- 5) Trigger também em INSERT (caso venda já entre como PAGA)
CREATE OR REPLACE FUNCTION public.qa_vendas_arsenal_upgrade_insert_trg()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF upper(btrim(COALESCE(NEW.status, ''))) = 'PAGO' THEN
    PERFORM public.qa_arsenal_processar_pagamento_venda(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_qa_vendas_arsenal_upgrade_insert ON public.qa_vendas;
CREATE TRIGGER trg_qa_vendas_arsenal_upgrade_insert
  AFTER INSERT ON public.qa_vendas
  FOR EACH ROW
  EXECUTE FUNCTION public.qa_vendas_arsenal_upgrade_insert_trg();

-- 6) Backfill: quem já tem venda paga vira premium (idempotente)
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT DISTINCT v.id AS venda_id
    FROM public.qa_vendas v
    JOIN public.qa_clientes c ON c.id_legado = v.cliente_id
    WHERE upper(btrim(v.status)) = 'PAGO'
      AND c.arsenal_plano <> 'premium'
  LOOP
    PERFORM public.qa_arsenal_processar_pagamento_venda(r.venda_id);
  END LOOP;
END $$;

-- 7) Comentários
COMMENT ON COLUMN public.qa_clientes.arsenal_plano IS 'Plano atual no app Arsenal: free | premium';
COMMENT ON COLUMN public.qa_clientes.arsenal_status IS 'Situação da conta Arsenal: ativo | suspenso | cancelado';
COMMENT ON COLUMN public.qa_clientes.arsenal_upgrade_em IS 'Data/hora do upgrade para premium (preenchido automaticamente quando venda vira PAGA)';
COMMENT ON TABLE public.qa_arsenal_notificacoes IS 'Notificações in-app exibidas no app Arsenal do cliente';
COMMENT ON FUNCTION public.qa_arsenal_processar_pagamento_venda IS 'Processa upgrade para premium quando venda vira PAGA (idempotente)';