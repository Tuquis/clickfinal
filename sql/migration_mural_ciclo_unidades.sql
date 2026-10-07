-- ============================================================
-- MIGRATION: divide o tipo "ciclo_assuntos" do mural em 4 unidades
-- (1ª, 2ª, 3ª, 4ª) — mesmo padrão já aplicado ao boletim.
--
-- Diferente do boletim, "ciclo_assuntos" continua visível pra
-- psicopedagoga/professor (além de admin + o próprio aluno). Como a
-- política de RLS checava IGUALDADE EXATA com 'ciclo_assuntos', ela
-- precisa virar um LIKE 'ciclo_assuntos%' pra continuar valendo pras
-- 4 unidades novas (ciclo_assuntos_1..4) sem perder esse acesso.
-- ============================================================

-- Migra o(s) registro(s) existentes com tipo='ciclo_assuntos' pra
-- 'ciclo_assuntos_1' (1ª unidade) antes de apertar a constraint.
ALTER TABLE public.mural_aluno DROP CONSTRAINT IF EXISTS mural_aluno_tipo_check;

UPDATE public.mural_aluno SET tipo = 'ciclo_assuntos_1' WHERE tipo = 'ciclo_assuntos';

ALTER TABLE public.mural_aluno ADD CONSTRAINT mural_aluno_tipo_check
    CHECK (tipo IN (
        'ciclo_assuntos_1', 'ciclo_assuntos_2', 'ciclo_assuntos_3', 'ciclo_assuntos_4',
        'calendario_avaliacoes', 'calendario_aulas',
        'boletim_1', 'boletim_2', 'boletim_3', 'boletim_4'
    ));

-- RLS da tabela: troca igualdade exata por prefixo
DROP POLICY IF EXISTS "mural_select" ON public.mural_aluno;
CREATE POLICY "mural_select" ON public.mural_aluno FOR SELECT
    USING (
        aluno_id = public.get_user_id()
        OR public.get_user_role() = 'admin'
        OR (tipo LIKE 'ciclo_assuntos%' AND public.get_user_role() IN ('psicopedagoga', 'professor'))
    );

-- RLS do storage: mesma troca, no segmento de pasta {aluno_id}/{tipo}/...
DROP POLICY IF EXISTS "mural_aluno_storage_select" ON storage.objects;
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
