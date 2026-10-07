-- ============================================================
-- MIGRATION: mural_aluno — aluno anexa fotos do que está estudando,
-- calendários e boletim, cada um dividido em até 4 unidades. Execute
-- no SQL Editor do Supabase, ou via `supabase db query --linked -f
-- <este arquivo>`.
--
-- Tipos na tabela, com visibilidade diferente:
--   - ciclo_assuntos_1..4:   aluno, admin, psicopedagoga e professor veem
--   - calendario_avaliacoes: só o aluno (dono) e admin veem
--   - calendario_aulas:      só o aluno (dono) e admin veem
--   - boletim_1..4:          só o aluno (dono) e admin veem
--
-- A regra na política abaixo é "só tipo começando com ciclo_assuntos
-- é liberado pra psicopedagoga/professor" — qualquer tipo novo que
-- não comece com esse prefixo já nasce restrito a admin+dono, sem
-- precisar mexer na política de novo.
--
-- Os arquivos ficam num bucket PRIVADO (mural-aluno) — o acesso é
-- sempre via signed URL gerada na hora, nunca um link público fixo.
-- Isso é o que garante o sigilo do boletim de verdade (não dá pra
-- adivinhar/vazar a URL, porque ela expira e exige permissão).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.mural_aluno (
    id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    aluno_id    UUID        NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    tipo        TEXT        NOT NULL DEFAULT 'ciclo_assuntos_1' CHECK (tipo IN (
        'ciclo_assuntos_1', 'ciclo_assuntos_2', 'ciclo_assuntos_3', 'ciclo_assuntos_4',
        'calendario_avaliacoes', 'calendario_aulas',
        'boletim_1', 'boletim_2', 'boletim_3', 'boletim_4'
    )),
    texto       TEXT        CHECK (texto IS NULL OR char_length(texto) <= 500),
    anexo_path  TEXT        NOT NULL,
    anexo_nome  TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.mural_aluno ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mural_select" ON public.mural_aluno;
DROP POLICY IF EXISTS "mural_insert" ON public.mural_aluno;
DROP POLICY IF EXISTS "mural_delete" ON public.mural_aluno;

-- SELECT: o próprio aluno vê tudo que postou; admin vê tudo de todos;
-- psicopedagoga/professor só veem posts do tipo "ciclo_assuntos_*"
-- (boletim/calendários NUNCA aparecem pra eles, nem a linha da tabela)
CREATE POLICY "mural_select" ON public.mural_aluno FOR SELECT
    USING (
        aluno_id = public.get_user_id()
        OR public.get_user_role() = 'admin'
        OR (tipo LIKE 'ciclo_assuntos%' AND public.get_user_role() IN ('psicopedagoga', 'professor'))
    );

-- INSERT: só o próprio aluno, só como ele mesmo
CREATE POLICY "mural_insert" ON public.mural_aluno FOR INSERT
    WITH CHECK (
        aluno_id = public.get_user_id()
        AND public.get_user_role() = 'aluno'
    );

-- DELETE: aluno apaga o que postou, admin pode moderar
CREATE POLICY "mural_delete" ON public.mural_aluno FOR DELETE
    USING (
        aluno_id = public.get_user_id()
        OR public.get_user_role() = 'admin'
    );

CREATE INDEX IF NOT EXISTS idx_mural_aluno_data
    ON public.mural_aluno(aluno_id, tipo, created_at DESC);


-- ══════════════════════════════════════════════════════════════
-- STORAGE — bucket privado + políticas
-- Caminho dos arquivos: {aluno_id}/{tipo}/{timestamp}-{nome}
-- ══════════════════════════════════════════════════════════════

INSERT INTO storage.buckets (id, name, public)
    VALUES ('mural-aluno', 'mural-aluno', false)
    ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "mural_aluno_storage_insert" ON storage.objects;
DROP POLICY IF EXISTS "mural_aluno_storage_select" ON storage.objects;
DROP POLICY IF EXISTS "mural_aluno_storage_delete" ON storage.objects;

-- INSERT: só aluno, e só dentro da própria pasta ({aluno_id}/...)
CREATE POLICY "mural_aluno_storage_insert" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'mural-aluno'
        AND public.get_user_role() = 'aluno'
        AND (storage.foldername(name))[1] = public.get_user_id()::text
    );

-- SELECT: dono do arquivo, admin (tudo), ou psico/professor só na
-- subpasta "ciclo" — mesma regra de visibilidade da tabela acima
CREATE POLICY "mural_aluno_storage_select" ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'mural-aluno'
        AND (
            (storage.foldername(name))[1] = public.get_user_id()::text
            OR public.get_user_role() = 'admin'
            OR ((storage.foldername(name))[2] LIKE 'ciclo_assuntos%' AND public.get_user_role() IN ('psicopedagoga', 'professor'))
        )
    );

-- DELETE: dono do arquivo ou admin
CREATE POLICY "mural_aluno_storage_delete" ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'mural-aluno'
        AND (
            (storage.foldername(name))[1] = public.get_user_id()::text
            OR public.get_user_role() = 'admin'
        )
    );
