
-- 1) Colunas em qa_psico_credenciados (espelhando IATs)
ALTER TABLE public.qa_psico_credenciados
  ADD COLUMN IF NOT EXISTS geocode_falhou boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS geocode_tentativas integer NOT NULL DEFAULT 0;

-- 2) Limpa sentinela inválido (-91, -91) usado anteriormente
UPDATE public.qa_psico_credenciados
   SET latitude = NULL, longitude = NULL, geocode_falhou = true
 WHERE latitude = -91 OR longitude = -91;

-- 3) Índice de pendentes (acelera seleção do backfill/watcher)
CREATE INDEX IF NOT EXISTS qa_psico_credenciados_geocode_pendentes_idx
  ON public.qa_psico_credenciados (uf, id)
  WHERE latitude IS NULL
    AND geocode_falhou IS NOT TRUE
    AND endereco IS NOT NULL
    AND endereco <> '';

-- 4) Reprocessa falhas (possíveis vítimas de throttling 1 req/s Nominatim)
UPDATE public.qa_iat_credenciados
   SET geocode_falhou = false, geocode_tentativas = 0
 WHERE geocode_falhou = true;

UPDATE public.qa_psico_credenciados
   SET geocode_falhou = false, geocode_tentativas = 0
 WHERE geocode_falhou = true;

-- 5) Garante driver único: remove agendamentos redundantes de backfill,
--    mantendo apenas o watcher (iat-geocode-watcher) como driver oficial.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT jobid, jobname
      FROM cron.job
     WHERE jobname ILIKE '%iat-geocode-driver%'
        OR jobname ILIKE '%iat-geocode-backfill%'
        OR jobname ILIKE '%qa-iat-credenciados-geocode-backfill%'
        OR jobname ILIKE '%psico-geocode-driver%'
        OR jobname ILIKE '%psico-geocode-backfill%'
        OR jobname ILIKE '%qa-psico-credenciados-geocode-backfill%'
  LOOP
    PERFORM cron.unschedule(r.jobid);
    RAISE NOTICE 'unscheduled redundant geocode job: %', r.jobname;
  END LOOP;
END $$;
