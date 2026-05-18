-- ============================================================
-- MIGRATION: aulas sem aluno
-- Adiciona suporte a registrar aulas em que o aluno não apareceu.
-- Execute no SQL Editor do Supabase.
-- ============================================================

-- 1. Coluna na tabela de relatórios para marcar aulas sem aluno
ALTER TABLE public.relatorios
    ADD COLUMN IF NOT EXISTS sem_aluno BOOLEAN NOT NULL DEFAULT false;

-- 2. Contador dedicado em professores_info
ALTER TABLE public.professores_info
    ADD COLUMN IF NOT EXISTS saldo_aulas_sem_aluno INTEGER NOT NULL DEFAULT 0;
