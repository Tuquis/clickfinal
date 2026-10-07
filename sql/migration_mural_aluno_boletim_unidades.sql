-- ============================================================
-- MIGRATION: divide o tipo "boletim" do mural em 4 unidades
-- (1ª, 2ª, 3ª, 4ª). Não muda nenhuma política de RLS — a regra já
-- era "só ciclo_assuntos é visível pra psico/professor, qualquer
-- outro tipo é admin+dono apenas", então os 4 tipos novos já
-- nascem com a mesma restrição do boletim antigo, automaticamente.
--
-- Migra o(s) registro(s) que já existem com tipo='boletim' pra
-- 'boletim_1' (1ª unidade) antes de apertar a constraint, pra não
-- perder/invalidar dado real em produção.
-- ============================================================

-- Solta a constraint antes de migrar o dado (senão o UPDATE abaixo
-- esbarra na própria regra antiga, que só aceitava 'boletim').
ALTER TABLE public.mural_aluno DROP CONSTRAINT IF EXISTS mural_aluno_tipo_check;

UPDATE public.mural_aluno SET tipo = 'boletim_1' WHERE tipo = 'boletim';

ALTER TABLE public.mural_aluno ADD CONSTRAINT mural_aluno_tipo_check
    CHECK (tipo IN (
        'ciclo_assuntos',
        'calendario_avaliacoes',
        'calendario_aulas',
        'boletim_1',
        'boletim_2',
        'boletim_3',
        'boletim_4'
    ));
