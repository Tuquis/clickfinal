-- ============================================================
-- MIGRATION: mensagens_diretas — chat direto professor/aluno
-- Execute no SQL Editor do Supabase.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.mensagens_diretas (
    id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    remetente_id    UUID        NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    destinatario_id UUID        NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    conteudo        TEXT        NOT NULL CHECK (char_length(conteudo) BETWEEN 1 AND 2000),
    lida            BOOLEAN     NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.mensagens_diretas ENABLE ROW LEVEL SECURITY;

-- SELECT: remetente, destinatário ou admin
CREATE POLICY "md_select" ON public.mensagens_diretas FOR SELECT
    USING (
        remetente_id    = public.get_user_id()
        OR destinatario_id = public.get_user_id()
        OR public.get_user_role() = 'admin'
    );

-- INSERT: apenas como você mesmo
CREATE POLICY "md_insert" ON public.mensagens_diretas FOR INSERT
    WITH CHECK (remetente_id = public.get_user_id());

-- UPDATE: destinatário marca como lido
CREATE POLICY "md_update" ON public.mensagens_diretas FOR UPDATE
    USING (
        destinatario_id = public.get_user_id()
        OR public.get_user_role() = 'admin'
    );

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_md_remetente
    ON public.mensagens_diretas(remetente_id, created_at);

CREATE INDEX IF NOT EXISTS idx_md_destinatario
    ON public.mensagens_diretas(destinatario_id, created_at);

CREATE INDEX IF NOT EXISTS idx_md_nao_lidas
    ON public.mensagens_diretas(destinatario_id, lida)
    WHERE lida = false;

-- Habilita Realtime para o módulo de chat
ALTER PUBLICATION supabase_realtime ADD TABLE public.mensagens_diretas;
