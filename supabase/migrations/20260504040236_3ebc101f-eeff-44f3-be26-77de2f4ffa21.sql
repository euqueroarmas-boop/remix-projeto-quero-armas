-- F1B-4: Munições por movimentações
CREATE TABLE IF NOT EXISTS public.qa_municoes_movimentacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id integer NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('ENTRADA','SAIDA')),
  calibre text NOT NULL,
  marca text,
  lote text,
  quantidade integer NOT NULL CHECK (quantidade > 0),
  data_movimentacao date NOT NULL DEFAULT CURRENT_DATE,
  data_fabricacao date,
  data_validade date,
  motivo text,
  observacao text,
  documento_url text,
  documento_nome text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    tipo = 'ENTRADA' OR motivo IN ('treino','competicao','baixa_ajuste','transferencia','legitima_defesa','outro')
  )
);

CREATE INDEX IF NOT EXISTS idx_qa_munmov_cliente ON public.qa_municoes_movimentacoes(cliente_id);
CREATE INDEX IF NOT EXISTS idx_qa_munmov_calibre ON public.qa_municoes_movimentacoes(cliente_id, calibre);
CREATE INDEX IF NOT EXISTS idx_qa_munmov_lote ON public.qa_municoes_movimentacoes(cliente_id, calibre, COALESCE(marca,''), COALESCE(lote,''));

ALTER TABLE public.qa_municoes_movimentacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY qa_munmov_staff_all ON public.qa_municoes_movimentacoes
  FOR ALL TO authenticated
  USING (public.qa_is_active_staff(auth.uid()))
  WITH CHECK (public.qa_is_active_staff(auth.uid()));

CREATE POLICY qa_munmov_owner_select ON public.qa_municoes_movimentacoes
  FOR SELECT TO authenticated
  USING (cliente_id = public.qa_current_cliente_id(auth.uid()));

-- Trigger: updated_at
CREATE TRIGGER trg_qa_munmov_updated
  BEFORE UPDATE ON public.qa_municoes_movimentacoes
  FOR EACH ROW EXECUTE FUNCTION public.lp_set_updated_at();

-- Trigger: preencher data_validade (fab + 60 meses) e validar regras
CREATE OR REPLACE FUNCTION public.qa_munmov_before_iu()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  saldo_atual integer;
BEGIN
  -- Normalizações
  NEW.calibre := UPPER(TRIM(NEW.calibre));
  IF NEW.marca IS NOT NULL THEN NEW.marca := UPPER(TRIM(NEW.marca)); END IF;
  IF NEW.lote  IS NOT NULL THEN NEW.lote  := UPPER(TRIM(NEW.lote));  END IF;

  -- Validade automática
  IF NEW.data_validade IS NULL AND NEW.data_fabricacao IS NOT NULL THEN
    NEW.data_validade := (NEW.data_fabricacao + INTERVAL '60 months')::date;
  END IF;

  -- Motivo "outro" exige observação
  IF NEW.tipo = 'SAIDA' AND NEW.motivo = 'outro'
     AND (NEW.observacao IS NULL OR length(trim(NEW.observacao)) = 0) THEN
    RAISE EXCEPTION 'Motivo "outro" exige observação detalhada.' USING ERRCODE = 'check_violation';
  END IF;

  -- Bloquear saldo negativo (apenas em INSERT; updates do mesmo registro recalculados)
  IF NEW.tipo = 'SAIDA' AND TG_OP = 'INSERT' THEN
    SELECT COALESCE(SUM(CASE tipo WHEN 'ENTRADA' THEN quantidade ELSE -quantidade END), 0)
      INTO saldo_atual
      FROM public.qa_municoes_movimentacoes
     WHERE cliente_id = NEW.cliente_id
       AND calibre    = NEW.calibre
       AND COALESCE(marca,'') = COALESCE(NEW.marca,'')
       AND COALESCE(lote, '') = COALESCE(NEW.lote, '');
    IF saldo_atual < NEW.quantidade THEN
      RAISE EXCEPTION 'Saldo insuficiente para saída (saldo atual: %, solicitado: %).',
        saldo_atual, NEW.quantidade USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_qa_munmov_before_iu
  BEFORE INSERT OR UPDATE ON public.qa_municoes_movimentacoes
  FOR EACH ROW EXECUTE FUNCTION public.qa_munmov_before_iu();

-- View de saldos agregados por lote
CREATE OR REPLACE VIEW public.qa_municoes_saldos AS
SELECT
  cliente_id,
  calibre,
  COALESCE(marca,'') AS marca,
  COALESCE(lote,'')  AS lote,
  MIN(data_fabricacao) FILTER (WHERE tipo = 'ENTRADA') AS data_fabricacao,
  MIN(data_validade)   FILTER (WHERE tipo = 'ENTRADA') AS data_validade,
  SUM(CASE tipo WHEN 'ENTRADA' THEN quantidade ELSE -quantidade END)::integer AS saldo,
  SUM(CASE tipo WHEN 'ENTRADA' THEN quantidade ELSE 0 END)::integer AS total_entradas,
  SUM(CASE tipo WHEN 'SAIDA'   THEN quantidade ELSE 0 END)::integer AS total_saidas,
  MAX(data_movimentacao) AS ultima_movimentacao
FROM public.qa_municoes_movimentacoes
GROUP BY cliente_id, calibre, COALESCE(marca,''), COALESCE(lote,'');

GRANT SELECT ON public.qa_municoes_saldos TO authenticated, anon;