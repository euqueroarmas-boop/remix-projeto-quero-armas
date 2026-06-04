SELECT cron.schedule(
  'qa-processo-prazo-alertas-daily',
  '0 7 * * *',
  $$
  SELECT net.http_post(
    url := 'https://ogkltfqvzweeqkfmrzts.supabase.co/functions/v1/qa-processo-prazo-alertas',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-token', current_setting('app.cron_token', true)
    ),
    body := jsonb_build_object('source','cron','at', now())
  );
  $$
);