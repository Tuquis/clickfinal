-- ============================================================
-- Cria o Database Webhook que dispara a Edge Function
-- notify-chat-message sempre que um aluno inserir uma mensagem.
-- Execute no SQL Editor do Supabase.
-- ============================================================

-- Habilita a extensão pg_net (necessária para webhooks HTTP via SQL)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Cria (ou recria) o webhook
SELECT supabase_functions.http_request(
  'POST',
  'https://kverxbbwvmxcdiqwcijp.supabase.co/functions/v1/notify-chat-message',
  '{"Content-Type":"application/json","Authorization":"Bearer <SEU_ANON_KEY>"}',
  '{}',
  '1000'
);

-- ⚠️  ATENÇÃO: o jeito correto no Supabase é via painel, não SQL.
-- Veja as instruções abaixo.
