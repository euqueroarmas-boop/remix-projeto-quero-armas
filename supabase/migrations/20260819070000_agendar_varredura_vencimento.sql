-- =============================================================================
-- A VARREDURA DE VENCIMENTO PASSA A RODAR TODO DIA (SEM MANDAR E-MAIL)
--
-- ACHADO (19/08/2026). A regra do usuário de 31/07 — "se vencer, deve ser
-- atualizado" — está implementada em `qa_reabrir_exigencias_documento_invalido`,
-- mas NUNCA rodou sozinha. A única chamada automática dela mora dentro da edge
-- function `qa-vencimentos-alertas`, e o `cron.job` mostra 11 agendamentos
-- ativos, NENHUM deles apontando para essa function. Ou seja: desde 01/08 a
-- varredura só rodou no dia em que a migration a criou.
--
-- Consequência prática: documento vence e a exigência do processo continua
-- marcada como cumprida. Ninguém é cobrado, ninguém é avisado, e o processo
-- segue para protocolo com um documento fora de validade por trás.
--
-- POR QUE AGENDAR O SQL, E NÃO A EDGE FUNCTION.
-- São duas coisas diferentes, e só uma foi decidida:
--
--   • REABRIR a exigência vencida  → regra já decidida em 31/07. É SQL puro,
--     não manda mensagem para ninguém, não depende de chave nem de deploy.
--     É o que esta migration agenda.
--
--   • ENVIAR o e-mail de aviso de vencimento → a edge function envia de
--     verdade desde 22/07 (`dry_run` deixou de ser o padrão). Agendá-la
--     significa começar a disparar e-mail para toda a base no primeiro
--     ciclo. Decisão à parte, do usuário. Esta migration NÃO faz isso.
--
-- Horário: 06:10 UTC = 03:10 BRT. Antes de qualquer alerta (o primeiro é
-- 07:00 UTC), para que a fila do dia já saia com as exigências reabertas.
--
-- PRÉ-REQUISITO: aplicar antes a 20260819060000, que impede a varredura de
-- reabrir exigência marcada `nao_aplicavel`. Sem ela, o primeiro ciclo depois
-- de 09/09 volta a cobrar extrato do INSS de um aposentado.
--
-- Idempotente: desagenda antes de agendar.
-- =============================================================================

BEGIN;

SELECT cron.unschedule('qa-reabrir-exigencias-vencidas-diario')
 WHERE EXISTS (
   SELECT 1 FROM cron.job WHERE jobname = 'qa-reabrir-exigencias-vencidas-diario'
 );

SELECT cron.schedule(
  'qa-reabrir-exigencias-vencidas-diario',
  '10 6 * * *',
  $$ SELECT public.qa_reabrir_exigencias_documento_invalido(); $$
);

COMMIT;
