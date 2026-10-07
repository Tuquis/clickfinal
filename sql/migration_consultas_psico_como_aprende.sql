-- ============================================================
-- MIGRATION: pergunta dedicada "Como esse aluno aprende melhor"
-- na consulta da psicopedagoga. Antes, o card de perfil do aluno
-- reaproveitava o campo "Estratégias utilizadas" (que é sobre o que
-- ela fez NESSA sessão, não um retrato estável de como o aluno
-- aprende) — agora vira um campo próprio, obrigatório na consulta.
-- ============================================================

ALTER TABLE public.consultas_psico
    ADD COLUMN IF NOT EXISTS como_aprende_melhor TEXT;
