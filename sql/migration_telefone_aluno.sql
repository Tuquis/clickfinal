-- ============================================================
-- MIGRATION: campo whatsapp do aluno para notificações
-- Execute no SQL Editor do Supabase.
-- ============================================================

ALTER TABLE public.alunos_info
    ADD COLUMN IF NOT EXISTS telefone_aluno TEXT;

-- Atualiza a view para expor o novo campo
CREATE OR REPLACE VIEW public.v_alunos_completo AS
SELECT
    u.id,
    u.nome,
    u.email,
    u.ativo,
    u.created_at,
    ai.serie,
    ai.disciplina,
    ai.responsavel,
    ai.telefone,
    ai.aulas_disponiveis,
    ai.telefone_aluno
FROM public.usuarios u
LEFT JOIN public.alunos_info ai ON ai.usuario_id = u.id
WHERE u.role = 'aluno';
