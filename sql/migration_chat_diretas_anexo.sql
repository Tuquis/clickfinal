-- ============================================================
-- MIGRATION: anexos de imagem no chat direto (mensagens_diretas)
-- Execute no SQL Editor do Supabase.
-- ============================================================

ALTER TABLE public.mensagens_diretas ADD COLUMN IF NOT EXISTS anexo_url  TEXT;
ALTER TABLE public.mensagens_diretas ADD COLUMN IF NOT EXISTS anexo_nome TEXT;
ALTER TABLE public.mensagens_diretas ADD COLUMN IF NOT EXISTS anexo_tipo TEXT;

-- Permite mensagem só com foto (sem texto)
ALTER TABLE public.mensagens_diretas ALTER COLUMN conteudo DROP NOT NULL;
ALTER TABLE public.mensagens_diretas DROP CONSTRAINT IF EXISTS mensagens_diretas_conteudo_check;
ALTER TABLE public.mensagens_diretas ADD CONSTRAINT mensagens_diretas_conteudo_check
    CHECK (
        char_length(coalesce(conteudo, '')) <= 2000
        AND (char_length(coalesce(conteudo, '')) > 0 OR anexo_url IS NOT NULL)
    );

-- Bucket público para as fotos do chat (idempotente — pode já existir)
INSERT INTO storage.buckets (id, name, public)
    VALUES ('chat-anexos', 'chat-anexos', true)
    ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "chat_anexos_upload" ON storage.objects;
DROP POLICY IF EXISTS "chat_anexos_read"   ON storage.objects;

CREATE POLICY "chat_anexos_upload" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'chat-anexos' AND auth.role() = 'authenticated');
CREATE POLICY "chat_anexos_read" ON storage.objects
    FOR SELECT USING (bucket_id = 'chat-anexos');
