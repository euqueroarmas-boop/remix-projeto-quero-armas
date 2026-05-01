-- Corrige bug: qa_itens_venda.id é INTEGER, não UUID.
-- A função usava COALESCE com sentinel UUID, causando 
-- "COALESCE types integer and uuid cannot be matched" no INSERT.
CREATE OR REPLACE FUNCTION public.qa_itens_venda_validate_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_status TEXT := NEW.status;
  v_ok BOOLEAN := FALSE;
BEGIN
  IF v_status IS NULL OR btrim(v_status) = '' THEN
    RETURN NEW;
  END IF;

  -- 1) código canônico ativo
  SELECT EXISTS (
    SELECT 1 FROM public.qa_status_servico
    WHERE codigo = v_status AND ativo = TRUE
  ) INTO v_ok;
  IF v_ok THEN RETURN NEW; END IF;

  -- 2) nome legado
  SELECT EXISTS (
    SELECT 1 FROM public.qa_status_servico
    WHERE upper(btrim(nome)) = upper(btrim(v_status))
  ) INTO v_ok;
  IF v_ok THEN RETURN NEW; END IF;

  -- 3) status já presente em registros históricos do próprio qa_itens_venda
  --    qa_itens_venda.id é INTEGER — usar -1 como sentinel.
  SELECT EXISTS (
    SELECT 1 FROM public.qa_itens_venda
    WHERE upper(btrim(status)) = upper(btrim(v_status))
      AND id <> COALESCE(NEW.id, -1)
  ) INTO v_ok;
  IF v_ok THEN RETURN NEW; END IF;

  RAISE EXCEPTION 'Status inválido: "%". Cadastre-o em Configurações > Status dos Serviços (Equipe Quero Armas).', v_status
    USING ERRCODE = '23514';
END;
$function$;