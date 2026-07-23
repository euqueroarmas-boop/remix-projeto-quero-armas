-- Safety net: quando o contrato E a procuração ficam validated para o mesmo
-- cliente, garante que o checklist do processo esteja materializado, mesmo
-- que o pipeline pós-pagamento tenha falhado ou o pagamento ainda esteja em
-- "a_combinar". A função qa_explodir_checklist_processo já é idempotente
-- (retorna inseridos + já_existentes), então re-chamar não duplica nada.

CREATE OR REPLACE FUNCTION public.qa_dispatch_explodir_apos_contrato_procuracao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cliente_id integer;
  v_tem_contrato_validado boolean;
  v_tem_procuracao_valida boolean;
  v_proc record;
BEGIN
  -- Este trigger vive tanto em qa_contracts quanto em qa_procuracoes.
  -- Descobre o cliente_id do NEW (funciona nas duas tabelas).
  v_cliente_id := NEW.cliente_id;
  IF v_cliente_id IS NULL THEN RETURN NEW; END IF;

  -- Só age quando o registro tocado ficou validado
  IF NEW.status IS DISTINCT FROM 'validated' AND NEW.status IS DISTINCT FROM 'reaproveitada' THEN
    RETURN NEW;
  END IF;

  -- Confere se há contrato validated para o cliente
  SELECT EXISTS (
    SELECT 1 FROM public.qa_contracts
    WHERE cliente_id = v_cliente_id AND status = 'validated'
  ) INTO v_tem_contrato_validado;
  IF NOT v_tem_contrato_validado THEN RETURN NEW; END IF;

  -- Confere se há procuração validated ou reaproveitada
  SELECT EXISTS (
    SELECT 1 FROM public.qa_procuracoes
    WHERE cliente_id = v_cliente_id AND status IN ('validated', 'reaproveitada')
  ) INTO v_tem_procuracao_valida;
  IF NOT v_tem_procuracao_valida THEN RETURN NEW; END IF;

  -- Ambos OK — explode checklist de TODOS os processos ativos do cliente
  -- que ainda não foram materializados. qa_explodir_checklist_processo é
  -- idempotente; apenas insere o que falta.
  FOR v_proc IN
    SELECT p.id
    FROM public.qa_processos p
    WHERE p.cliente_id = v_cliente_id
      AND COALESCE(p.status, '') NOT IN ('cancelado', 'finalizado', 'indeferido')
  LOOP
    BEGIN
      PERFORM public.qa_explodir_checklist_processo(v_proc.id);
    EXCEPTION WHEN OTHERS THEN
      -- Nunca falha o UPDATE original por conta do fallback
      NULL;
    END;
  END LOOP;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

-- Instala o mesmo trigger em qa_contracts e qa_procuracoes
DROP TRIGGER IF EXISTS trg_qa_contract_explodir_checklist ON public.qa_contracts;
CREATE TRIGGER trg_qa_contract_explodir_checklist
AFTER UPDATE OF status ON public.qa_contracts
FOR EACH ROW EXECUTE FUNCTION public.qa_dispatch_explodir_apos_contrato_procuracao();

DROP TRIGGER IF EXISTS trg_qa_procuracao_explodir_checklist ON public.qa_procuracoes;
CREATE TRIGGER trg_qa_procuracao_explodir_checklist
AFTER INSERT OR UPDATE OF status ON public.qa_procuracoes
FOR EACH ROW EXECUTE FUNCTION public.qa_dispatch_explodir_apos_contrato_procuracao();
