-- ============================================================
-- CRON SETUP: disparo automático da Edge Function a cada minuto
-- Execute no SQL Editor do Supabase APÓS o deploy da Edge Function
--
-- Substitua <CRON_SECRET> pelo mesmo valor definido nas
-- variáveis de ambiente da Edge Function.
-- ============================================================

-- Habilita extensões necessárias (já disponíveis no Supabase)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove o job anterior se existir (para re-executar com segurança)
SELECT cron.unschedule('send-class-reminders')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'send-class-reminders'
);

-- Agenda: a cada minuto, chama a Edge Function com o segredo de autenticação
SELECT cron.schedule(
  'send-class-reminders',
  '* * * * *',
  $$
  SELECT net.http_post(
    url     := 'https://kverxbbwvmxcdiqwcijp.supabase.co/functions/v1/send-class-reminders',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'x-cron-secret', 'SEU_CRON_SECRET_AQUI'
    ),
    body    := '{}'::jsonb
  );
  $$
);

-- Confirma que o job foi criado
SELECT jobid, jobname, schedule, command
FROM cron.job
WHERE jobname = 'send-class-reminders';
