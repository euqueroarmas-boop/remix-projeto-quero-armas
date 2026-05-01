-- Atualiza guarda de imutabilidade para permitir DELETE quando uma cascata
-- autorizada de processo está em curso (sinalizada por GUC de sessão).
CREATE OR REPLACE FUNCTION public.qa_processo_eventos_imutavel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_allow text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    BEGIN
      v_allow := current_setting('qa.allow_processo_cascade_delete', true);
    EXCEPTION WHEN OTHERS THEN
      v_allow := NULL;
    END;
    IF v_allow = 'on' THEN
      RETURN OLD;
    END IF;
    RAISE EXCEPTION 'qa_processo_eventos é imutável (DELETE bloqueado).';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.documento_id IS NULL
       AND OLD.documento_id IS NOT NULL
       AND NEW.id              IS NOT DISTINCT FROM OLD.id
       AND NEW.processo_id     IS NOT DISTINCT FROM OLD.processo_id
       AND NEW.tipo_evento     IS NOT DISTINCT FROM OLD.tipo_evento
       AND NEW.descricao       IS NOT DISTINCT FROM OLD.descricao
       AND NEW.dados_json      IS NOT DISTINCT FROM OLD.dados_json
       AND NEW.ator            IS NOT DISTINCT FROM OLD.ator
       AND NEW.user_id         IS NOT DISTINCT FROM OLD.user_id
       AND NEW.created_at      IS NOT DISTINCT FROM OLD.created_at
    THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'qa_processo_eventos é imutável (UPDATE bloqueado em colunas críticas).';
  END IF;
  RETURN NULL;
END;
$function$;

-- Trigger: ao deletar item de venda, remover processo correspondente
CREATE OR REPLACE FUNCTION public.qa_itens_venda_after_delete_cleanup_processos()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_venda_pk integer;
BEGIN
  SELECT v.id INTO v_venda_pk
  FROM public.qa_vendas v
  WHERE v.id = OLD.venda_id OR v.id_legado = OLD.venda_id
  LIMIT 1;

  IF v_venda_pk IS NOT NULL THEN
    PERFORM set_config('qa.allow_processo_cascade_delete', 'on', true);
    DELETE FROM public.qa_processos
    WHERE venda_id = v_venda_pk
      AND servico_id = OLD.servico_id;
    PERFORM set_config('qa.allow_processo_cascade_delete', 'off', true);
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_qa_itens_venda_cleanup_processos ON public.qa_itens_venda;
CREATE TRIGGER trg_qa_itens_venda_cleanup_processos
AFTER DELETE ON public.qa_itens_venda
FOR EACH ROW
EXECUTE FUNCTION public.qa_itens_venda_after_delete_cleanup_processos();

-- Trigger: ao deletar venda inteira, remover todos os processos vinculados
CREATE OR REPLACE FUNCTION public.qa_vendas_after_delete_cleanup_processos()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM set_config('qa.allow_processo_cascade_delete', 'on', true);
  DELETE FROM public.qa_processos WHERE venda_id = OLD.id;
  PERFORM set_config('qa.allow_processo_cascade_delete', 'off', true);
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_qa_vendas_cleanup_processos ON public.qa_vendas;
CREATE TRIGGER trg_qa_vendas_cleanup_processos
AFTER DELETE ON public.qa_vendas
FOR EACH ROW
EXECUTE FUNCTION public.qa_vendas_after_delete_cleanup_processos();

-- Limpeza one-shot de processos órfãos
DO $$
BEGIN
  PERFORM set_config('qa.allow_processo_cascade_delete', 'on', true);
  DELETE FROM public.qa_processos p
  WHERE NOT EXISTS (
    SELECT 1 FROM public.qa_vendas v WHERE v.id = p.venda_id
  )
  OR NOT EXISTS (
    SELECT 1
    FROM public.qa_itens_venda iv
    JOIN public.qa_vendas v2 ON (v2.id = iv.venda_id OR v2.id_legado = iv.venda_id)
    WHERE v2.id = p.venda_id AND iv.servico_id = p.servico_id
  );
  PERFORM set_config('qa.allow_processo_cascade_delete', 'off', true);
END $$;