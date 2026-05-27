-- ============================================================
-- MIGRATION: respostas de alunos às atividades
-- Execute no SQL Editor do Supabase.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.respostas_atividades (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    atividade_id UUID NOT NULL REFERENCES public.atividades(id) ON DELETE CASCADE,
    aluno_id     UUID NOT NULL REFERENCES public.usuarios(id)   ON DELETE CASCADE,
    arquivo_url  TEXT NOT NULL,
    arquivo_nome TEXT,
    visualizado  BOOLEAN NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(atividade_id, aluno_id)
);

CREATE INDEX IF NOT EXISTS idx_respostas_atividade  ON public.respostas_atividades(atividade_id);
CREATE INDEX IF NOT EXISTS idx_respostas_aluno      ON public.respostas_atividades(aluno_id);
CREATE INDEX IF NOT EXISTS idx_respostas_visualizado ON public.respostas_atividades(visualizado);

ALTER TABLE public.respostas_atividades ENABLE ROW LEVEL SECURITY;

-- Admin: acesso total
CREATE POLICY "respostas_admin_all" ON public.respostas_atividades
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.usuarios u WHERE u.auth_id = auth.uid() AND u.role = 'admin')
    );

-- Aluno: acesso total às próprias respostas
CREATE POLICY "respostas_aluno_own" ON public.respostas_atividades
    FOR ALL USING (
        aluno_id = (SELECT id FROM public.usuarios WHERE auth_id = auth.uid())
    );

-- Professor: pode ler respostas das suas atividades
CREATE POLICY "respostas_professor_select" ON public.respostas_atividades
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.atividades a
            WHERE a.id = atividade_id
              AND a.professor_id = (SELECT id FROM public.usuarios WHERE auth_id = auth.uid())
        )
    );

-- Professor: pode marcar como visualizado
CREATE POLICY "respostas_professor_update" ON public.respostas_atividades
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.atividades a
            WHERE a.id = atividade_id
              AND a.professor_id = (SELECT id FROM public.usuarios WHERE auth_id = auth.uid())
        )
    );
