-- ============================================================
-- MIGRATION: consultas psicopedagógicas
-- Execute no SQL Editor do Supabase.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.consultas_psico (
    id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    psico_id              UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    aluno_id              UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    data                  DATE NOT NULL DEFAULT CURRENT_DATE,
    areas_trabalhadas     TEXT[],
    humor_aluno           TEXT CHECK (humor_aluno IN ('tranquilo','agitado','ansioso','triste','motivado')),
    engajamento           TEXT CHECK (engajamento IN ('alto','medio','baixo')),
    observacoes           TEXT NOT NULL,
    estrategias           TEXT,
    recomendacoes_familia TEXT,
    encaminhamentos       TEXT,
    created_at            TIMESTAMPTZ DEFAULT NOW(),
    updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consultas_psico_aluno  ON public.consultas_psico(aluno_id);
CREATE INDEX IF NOT EXISTS idx_consultas_psico_psico  ON public.consultas_psico(psico_id);
CREATE INDEX IF NOT EXISTS idx_consultas_psico_data   ON public.consultas_psico(data DESC);

-- RLS
ALTER TABLE public.consultas_psico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "psico_consulta_select" ON public.consultas_psico
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.usuarios u WHERE u.auth_id = auth.uid()
                AND u.role IN ('admin','psicopedagoga'))
    );

CREATE POLICY "psico_consulta_insert" ON public.consultas_psico
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.usuarios u WHERE u.auth_id = auth.uid()
                AND u.role = 'psicopedagoga')
    );

CREATE POLICY "psico_consulta_update" ON public.consultas_psico
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.usuarios u WHERE u.auth_id = auth.uid()
                AND u.role = 'psicopedagoga')
        AND psico_id = (SELECT id FROM public.usuarios WHERE auth_id = auth.uid())
    );

CREATE POLICY "psico_consulta_delete" ON public.consultas_psico
    FOR DELETE USING (
        psico_id = (SELECT id FROM public.usuarios WHERE auth_id = auth.uid())
    );
