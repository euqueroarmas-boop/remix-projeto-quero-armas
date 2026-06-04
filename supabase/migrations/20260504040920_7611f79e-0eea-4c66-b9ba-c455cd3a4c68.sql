CREATE OR REPLACE FUNCTION public.qa_munmov_before_iu()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  saldo_outros integer;
BEGIN
  -- Auditoria: preencher created_by automaticamente em INSERT
  IF TG_OP = 'INSERT' AND NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;

  -- Travas de integridade
  IF TG_OP = 'UPDATE' THEN
    IF NEW.cliente_id <> OLD.cliente_id THEN
      RAISE EXCEPTION 'Não é permitido alterar o cliente da movimentação.' USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.tipo <> OLD.tipo THEN
      RAISE EXCEPTION 'Não é permitido alterar o tipo (ENTRADA/SAIDA) da movimentação.' USING ERRCODE = 'check_violation';
    END IF;
  END IF;

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

  -- Saldo: calcula soma EXCLUINDO o registro corrente, depois soma o novo valor
  IF NEW.tipo IN ('ENTRADA','SAIDA') THEN
    SELECT COALESCE(SUM(CASE tipo WHEN 'ENTRADA' THEN quantidade ELSE -quantidade END), 0)
      INTO saldo_outros
      FROM public.qa_municoes_movimentacoes
     WHERE cliente_id = NEW.cliente_id
       AND calibre    = NEW.calibre
       AND COALESCE(marca,'') = COALESCE(NEW.marca,'')
       AND COALESCE(lote, '') = COALESCE(NEW.lote, '')
       AND (TG_OP = 'INSERT' OR id <> NEW.id);

    IF (saldo_outros + CASE NEW.tipo WHEN 'ENTRADA' THEN NEW.quantidade ELSE -NEW.quantidade END) < 0 THEN
      RAISE EXCEPTION 'Saldo insuficiente: operação deixaria saldo negativo (saldo após: %).',
        saldo_outros + CASE NEW.tipo WHEN 'ENTRADA' THEN NEW.quantidade ELSE -NEW.quantidade END
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger BEFORE DELETE: impede remover ENTRADA que zeraria/negativaria saldo
CREATE OR REPLACE FUNCTION public.qa_munmov_before_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  saldo_apos integer;
BEGIN
  IF OLD.tipo = 'ENTRADA' THEN
    SELECT COALESCE(SUM(CASE tipo WHEN 'ENTRADA' THEN quantidade ELSE -quantidade END), 0)
      INTO saldo_apos
      FROM public.qa_municoes_movimentacoes
     WHERE cliente_id = OLD.cliente_id
       AND calibre    = OLD.calibre
       AND COALESCE(marca,'') = COALESCE(OLD.marca,'')
       AND COALESCE(lote, '') = COALESCE(OLD.lote, '')
       AND id <> OLD.id;
    IF saldo_apos < 0 THEN
      RAISE EXCEPTION 'Não é possível remover esta entrada: deixaria saldo negativo (% após exclusão).', saldo_apos
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_qa_munmov_before_delete ON public.qa_municoes_movimentacoes;
CREATE TRIGGER trg_qa_munmov_before_delete
  BEFORE DELETE ON public.qa_municoes_movimentacoes
  FOR EACH ROW EXECUTE FUNCTION public.qa_munmov_before_delete();