-- ============================================================
-- MIGRATION: suporte a anexos no chat (arquivos e imagens)
-- Execute no SQL Editor do Supabase
-- ============================================================

-- Adiciona colunas de anexo na tabela mensagens
ALTER TABLE public.mensagens
  ADD COLUMN IF NOT EXISTS anexo_url  TEXT,
  ADD COLUMN IF NOT EXISTS anexo_nome TEXT,
  ADD COLUMN IF NOT EXISTS anexo_tipo TEXT;

-- Remove a constraint que exige mínimo de 1 char no conteudo
-- (necessário para mensagens de só-anexo, sem texto)
ALTER TABLE public.mensagens
  DROP CONSTRAINT IF EXISTS mensagens_conteudo_check;

ALTER TABLE public.mensagens
  ADD CONSTRAINT mensagens_conteudo_check
  CHECK (
    char_length(conteudo) <= 2000
    AND (char_length(conteudo) > 0 OR anexo_url IS NOT NULL)
  );

-- ============================================================
-- Bucket de Storage para arquivos do chat
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-anexos', 'chat-anexos', true)
ON CONFLICT (id) DO NOTHING;

-- Usuários autenticados podem fazer upload
CREATE POLICY "chat_anexos_upload" ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'chat-anexos' AND auth.role() = 'authenticated');

-- Leitura pública (URL já é protegida por UUID no path)
CREATE POLICY "chat_anexos_read" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'chat-anexos');
