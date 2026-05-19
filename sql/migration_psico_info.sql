-- ============================================================
-- MIGRATION: tabela de informações da psicopedagoga
-- Execute no SQL Editor do Supabase.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.psico_info (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id  UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    link_meet   TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(usuario_id)
);

CREATE INDEX IF NOT EXISTS idx_psico_info_usuario ON public.psico_info(usuario_id);

ALTER TABLE public.psico_info ENABLE ROW LEVEL SECURITY;

CREATE POLICY "psico_info_admin_all" ON public.psico_info
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.usuarios u WHERE u.auth_id = auth.uid() AND u.role = 'admin')
    );

CREATE POLICY "psico_info_own_select" ON public.psico_info
    FOR SELECT USING (
        usuario_id = (SELECT id FROM public.usuarios WHERE auth_id = auth.uid())
    );

CREATE POLICY "psico_info_own_update" ON public.psico_info
    FOR UPDATE USING (
        usuario_id = (SELECT id FROM public.usuarios WHERE auth_id = auth.uid())
    );
