-- ============================================================
-- 1. Função: aplica indeferimento automático por prazo esgotado
-- ============================================================
CREATE OR REPLACE FUNCTION public.qa_itens_venda_auto_indeferido_recurso()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_data_evento date;
  v_prazo_final date;
  v_status_upper text;
BEGIN
  -- Aplica somente para serviços PF com prazo recursal (Posse=2, Porte=3, CRAF=26)
  IF NEW.servico_id IS NULL OR NEW.servico_id NOT IN (2, 3, 26) THEN
    RETURN NEW;
  END IF;

  v_status_upper := upper(btrim(coalesce(NEW.status, '')));

  -- Não mexer em status terminais
  IF v_status_upper IN ('DEFERIDO', 'INDEFERIDO', 'CONCLUÍDO', 'CONCLUIDO',
                        'CANCELADO', 'DESISTIU', 'RESTITUÍDO', 'RESTITUIDO') THEN
    RETURN NEW;
  END IF;

  -- Data-base do prazo: maior entre notificação, indeferimento e recurso administrativo
  v_data_evento := GREATEST(
    COALESCE(NEW.data_recurso_administrativo, '0001-01-01'::date),
    COALESCE(NEW.data_indeferimento,           '0001-01-01'::date),
    COALESCE(NEW.data_notificacao,             '0001-01-01'::date)
  );

  IF v_data_evento = '0001-01-01'::date THEN
    RETURN NEW;
  END IF;

  v_prazo_final := v_data_evento + INTERVAL '10 days';

  IF CURRENT_DATE > v_prazo_final::date THEN
    NEW.status                      := 'INDEFERIDO';
    NEW.data_indeferimento_recurso  := COALESCE(NEW.data_indeferimento_recurso, v_prazo_final::date);
    NEW.data_ultima_atualizacao     := CURRENT_DATE;
  END IF;

  RETURN NEW;
END;
$function$;

-- Trigger BEFORE INSERT/UPDATE
DROP TRIGGER IF EXISTS trg_qa_itens_venda_auto_indeferido_recurso ON public.qa_itens_venda;
CREATE TRIGGER trg_qa_itens_venda_auto_indeferido_recurso
BEFORE INSERT OR UPDATE ON public.qa_itens_venda
FOR EACH ROW
EXECUTE FUNCTION public.qa_itens_venda_auto_indeferido_recurso();

-- ============================================================
-- 2. Função: varredura diária (sweep) — aplica a regra a todos
--    os itens elegíveis cujo prazo já expirou.
-- ============================================================
CREATE OR REPLACE FUNCTION public.qa_sweep_indeferimento_por_prazo()
RETURNS TABLE(itens_atualizados int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_count int := 0;
BEGIN
  WITH alvos AS (
    SELECT id,
           GREATEST(
             COALESCE(data_recurso_administrativo, '0001-01-01'::date),
             COALESCE(data_indeferimento,           '0001-01-01'::date),
             COALESCE(data_notificacao,             '0001-01-01'::date)
           ) AS data_evento
    FROM public.qa_itens_venda
    WHERE servico_id IN (2, 3, 26)
      AND upper(btrim(coalesce(status, ''))) NOT IN (
        'DEFERIDO', 'INDEFERIDO', 'CONCLUÍDO', 'CONCLUIDO',
        'CANCELADO', 'DESISTIU', 'RESTITUÍDO', 'RESTITUIDO'
      )
      AND (data_recurso_administrativo IS NOT NULL
           OR data_indeferimento IS NOT NULL
           OR data_notificacao IS NOT NULL)
  ),
  expirados AS (
    SELECT id, (data_evento + INTERVAL '10 days')::date AS prazo_final
    FROM alvos
    WHERE data_evento <> '0001-01-01'::date
      AND CURRENT_DATE > (data_evento + INTERVAL '10 days')::date
  ),
  upd AS (
    UPDATE public.qa_itens_venda iv
       SET status                      = 'INDEFERIDO',
           data_indeferimento_recurso  = COALESCE(iv.data_indeferimento_recurso, e.prazo_final),
           data_ultima_atualizacao     = CURRENT_DATE
      FROM expirados e
     WHERE iv.id = e.id
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM upd;

  itens_atualizados := v_count;
  RETURN NEXT;
END;
$function$;

-- ============================================================
-- 3. Cron diário 09:00 UTC (06:00 BRT)
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Remove agendamento anterior (se existir) para evitar duplicidade
DO $$
DECLARE
  jid bigint;
BEGIN
  SELECT jobid INTO jid FROM cron.job WHERE jobname = 'qa_sweep_indeferimento_por_prazo_diario';
  IF jid IS NOT NULL THEN
    PERFORM cron.unschedule(jid);
  END IF;
END $$;

SELECT cron.schedule(
  'qa_sweep_indeferimento_por_prazo_diario',
  '0 9 * * *',
  $$ SELECT public.qa_sweep_indeferimento_por_prazo(); $$
);