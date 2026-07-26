
-- =========================================================
-- Arsenal Inteligente Premium: 90 dias grátis pós-assinatura
-- =========================================================

CREATE OR REPLACE FUNCTION public.qa_conceder_arsenal_premium_gratuito(
  p_cliente_id bigint,
  p_dias int DEFAULT 90,
  p_origem text DEFAULT 'servico_contratado'
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cpf text;
  v_id uuid;
  v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_fim  date := v_hoje + make_interval(days => p_dias);
BEGIN
  IF p_cliente_id IS NULL THEN RETURN NULL; END IF;

  -- Idempotência: se já existe gratuidade/ativa vigente, não cria nova.
  SELECT id INTO v_id
  FROM public.qa_arsenal_assinaturas
  WHERE cliente_id = p_cliente_id
    AND status IN ('gratuidade','ativa')
    AND periodo_fim >= v_hoje
  ORDER BY criado_em DESC
  LIMIT 1;

  IF v_id IS NOT NULL THEN
    -- Garante que o plano do cliente reflete a gratuidade vigente
    UPDATE public.qa_clientes
       SET arsenal_plano  = 'premium',
           arsenal_status = 'ativo',
           arsenal_upgrade_em = COALESCE(arsenal_upgrade_em, now())
     WHERE id = p_cliente_id
       AND (arsenal_plano IS DISTINCT FROM 'premium'
            OR arsenal_upgrade_em IS NULL);
    RETURN v_id;
  END IF;

  SELECT COALESCE(NULLIF(regexp_replace(cpf,'\D','','g'),''), '00000000000')
    INTO v_cpf
  FROM public.qa_clientes
  WHERE id = p_cliente_id;

  INSERT INTO public.qa_arsenal_assinaturas
    (cliente_id, cpf, status, origem_gratuidade, periodo_inicio, periodo_fim, valor_anual)
  VALUES
    (p_cliente_id, COALESCE(v_cpf,'00000000000'), 'gratuidade', p_origem, v_hoje, v_fim, 297)
  RETURNING id INTO v_id;

  UPDATE public.qa_clientes
     SET arsenal_plano = 'premium',
         arsenal_status = 'ativo',
         arsenal_upgrade_em = COALESCE(arsenal_upgrade_em, now())
   WHERE id = p_cliente_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.qa_conceder_arsenal_premium_gratuito(bigint,int,text) TO service_role;

-- Trigger: ao contrato virar 'validated', concede 90 dias.
CREATE OR REPLACE FUNCTION public.qa_contracts_trg_conceder_arsenal_premium()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'validated'
     AND (OLD.status IS DISTINCT FROM 'validated')
     AND NEW.cliente_id IS NOT NULL THEN
    PERFORM public.qa_conceder_arsenal_premium_gratuito(NEW.cliente_id, 90, 'servico_contratado');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_qa_contracts_conceder_arsenal_premium ON public.qa_contracts;
CREATE TRIGGER trg_qa_contracts_conceder_arsenal_premium
AFTER UPDATE OF status ON public.qa_contracts
FOR EACH ROW
EXECUTE FUNCTION public.qa_contracts_trg_conceder_arsenal_premium();

-- Backfill: clientes com contrato validado e sem assinatura vigente
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT DISTINCT c.cliente_id
    FROM public.qa_contracts c
    JOIN public.qa_clientes cl ON cl.id = c.cliente_id
    WHERE c.status = 'validated'
      AND (cl.excluido IS DISTINCT FROM true)
      AND NOT EXISTS (
        SELECT 1 FROM public.qa_arsenal_assinaturas a
        WHERE a.cliente_id = c.cliente_id
          AND a.status IN ('gratuidade','ativa')
          AND a.periodo_fim >= (now() AT TIME ZONE 'America/Sao_Paulo')::date
      )
  LOOP
    PERFORM public.qa_conceder_arsenal_premium_gratuito(r.cliente_id, 90, 'servico_contratado');
  END LOOP;
END $$;
