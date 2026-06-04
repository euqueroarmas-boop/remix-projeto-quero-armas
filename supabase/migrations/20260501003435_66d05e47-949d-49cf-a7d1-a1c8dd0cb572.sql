-- Permitir que o administrador principal (eu@queroarmas.com.br) e operações
-- de service_role excluam vendas. A trigger de imutabilidade de
-- qa_venda_eventos continua bloqueando DELETE/UPDATE para todos os outros
-- casos, preservando a auditoria.
--
-- A trigger existente RAISE EXCEPTION incondicionalmente. Substituímos por
-- versão que libera apenas para:
--   1. service_role (edge functions com privilégio)
--   2. usuário cujo email é eu@queroarmas.com.br (admin principal)
--   3. quando a sessão tiver app.allow_venda_evento_delete = 'on'
--      (set local em transação dentro de funções controladas)

CREATE OR REPLACE FUNCTION public.qa_venda_eventos_imutavel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_email text;
  v_role text := current_setting('request.jwt.claim.role', true);
  v_bypass text := current_setting('app.allow_venda_evento_delete', true);
BEGIN
  -- Bypass 1: service_role (edge functions privilegiadas)
  IF v_role = 'service_role' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  -- Bypass 2: flag de sessão explícita (controlada por funções confiáveis)
  IF v_bypass = 'on' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  -- Bypass 3: admin principal eu@queroarmas.com.br
  IF v_uid IS NOT NULL THEN
    SELECT email INTO v_email FROM auth.users WHERE id = v_uid;
    IF v_email = 'eu@queroarmas.com.br' THEN
      IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
    END IF;
  END IF;

  RAISE EXCEPTION 'qa_venda_eventos é imutável (acao=%).', TG_OP;
END;
$function$;