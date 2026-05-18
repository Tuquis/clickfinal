-- ============================================================
-- MIGRATION: agenda de consultas psicopedagógicas
-- Execute no SQL Editor do Supabase.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.agenda_psico (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    aluno_id    UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    psico_id    UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    data        DATE NOT NULL,
    horario     TIME NOT NULL,
    observacoes TEXT,
    status      TEXT NOT NULL DEFAULT 'agendada'
        CHECK (status IN ('agendada','realizada','cancelada')),
    created_by  UUID REFERENCES public.usuarios(id),
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agenda_psico_aluno  ON public.agenda_psico(aluno_id);
CREATE INDEX IF NOT EXISTS idx_agenda_psico_psico  ON public.agenda_psico(psico_id);
CREATE INDEX IF NOT EXISTS idx_agenda_psico_data   ON public.agenda_psico(data);

ALTER TABLE public.agenda_psico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agenda_psico_admin_all" ON public.agenda_psico
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.usuarios u WHERE u.auth_id = auth.uid() AND u.role = 'admin')
    );

CREATE POLICY "agenda_psico_psico_own" ON public.agenda_psico
    FOR ALL USING (
        psico_id = (SELECT id FROM public.usuarios WHERE auth_id = auth.uid())
    );

CREATE POLICY "agenda_psico_aluno_select" ON public.agenda_psico
    FOR SELECT USING (
        aluno_id = (SELECT id FROM public.usuarios WHERE auth_id = auth.uid())
    );
