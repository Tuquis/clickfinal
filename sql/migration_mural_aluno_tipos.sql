-- ============================================================
-- MIGRATION: adiciona "calendario_avaliacoes" e "calendario_aulas"
-- aos tipos aceitos em mural_aluno.tipo (antes só ciclo_assuntos/boletim).
--
-- Nada muda na política de RLS: ela já libera só "ciclo_assuntos"
-- pra psicopedagoga/professor e trata qualquer outro tipo como
-- admin+dono apenas — então os dois tipos novos já nascem com a
-- mesma visibilidade restrita do boletim, automaticamente.
-- ============================================================

ALTER TABLE public.mural_aluno DROP CONSTRAINT IF EXISTS mural_aluno_tipo_check;
ALTER TABLE public.mural_aluno ADD CONSTRAINT mural_aluno_tipo_check
    CHECK (tipo IN ('ciclo_assuntos', 'calendario_avaliacoes', 'calendario_aulas', 'boletim'));
