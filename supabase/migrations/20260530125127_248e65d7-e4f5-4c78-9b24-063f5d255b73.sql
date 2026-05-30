-- 1) Backfill: marca como pago todo cadastro cujo cliente já tem venda PAGO.
UPDATE public.qa_cadastro_publico c
SET pago = true,
    pago_em = COALESCE(c.pago_em, v.cobranca_gerada_em, now())
FROM public.qa_vendas v
WHERE c.cliente_id_vinculado IS NOT NULL
  AND v.cliente_id = c.cliente_id_vinculado
  AND UPPER(COALESCE(v.status,'')) = 'PAGO'
  AND c.pago = false;

-- 2) Dedupe: arquiva snapshots Mira duplicados (mesmo CPF + origem),
-- mantendo o mais recente (preferindo o que tem cliente_id_vinculado).
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY cpf, origem_cadastro
           ORDER BY (cliente_id_vinculado IS NOT NULL) DESC, created_at DESC
         ) AS rn
  FROM public.qa_cadastro_publico
  WHERE origem_cadastro = 'cadastro_mira'
    AND COALESCE(arquivado, false) = false
    AND status IN ('em_preenchimento','documentos_enviados','revisao_cliente','aguardando_pagamento')
)
UPDATE public.qa_cadastro_publico c
SET arquivado = true,
    arquivado_em = now(),
    motivo_arquivamento = 'duplicado_auto_dedupe'
FROM ranked r
WHERE c.id = r.id AND r.rn > 1;

-- 3) Trigger: ao confirmar PAGO em qa_vendas, propaga para o cadastro público.
CREATE OR REPLACE FUNCTION public.qa_propagar_pago_para_cadastro()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF UPPER(COALESCE(NEW.status,'')) = 'PAGO'
     AND (TG_OP = 'INSERT' OR UPPER(COALESCE(OLD.status,'')) <> 'PAGO')
     AND NEW.cliente_id IS NOT NULL THEN
    UPDATE public.qa_cadastro_publico
       SET pago = true,
           pago_em = COALESCE(pago_em, now())
     WHERE cliente_id_vinculado = NEW.cliente_id
       AND COALESCE(pago, false) = false;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_qa_vendas_propagar_pago ON public.qa_vendas;
CREATE TRIGGER trg_qa_vendas_propagar_pago
AFTER INSERT OR UPDATE OF status ON public.qa_vendas
FOR EACH ROW EXECUTE FUNCTION public.qa_propagar_pago_para_cadastro();

-- 4) Índice parcial para acelerar a dedupe por CPF/origem em andamento.
CREATE INDEX IF NOT EXISTS idx_qa_cadastro_publico_cpf_origem_andamento
  ON public.qa_cadastro_publico (cpf, origem_cadastro)
  WHERE COALESCE(arquivado,false) = false
    AND status IN ('em_preenchimento','documentos_enviados','revisao_cliente','aguardando_pagamento');