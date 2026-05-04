-- ============================================================
-- MIGRATION: Cronograma por dia + Exclusão de usuários
-- Execute no SQL Editor do Supabase
-- ============================================================

-- 1. Tarefas agora têm dia da semana e campo de informações
ALTER TABLE public.cronograma_tarefas
    ADD COLUMN IF NOT EXISTS dia_semana  INTEGER CHECK (dia_semana BETWEEN 0 AND 6),
    ADD COLUMN IF NOT EXISTS informacoes TEXT;

-- 2. Fix cascade constraints para permitir exclusão de usuários
--    (sem isso o DELETE em 'usuarios' falha por FK constraint)

-- relatorios: professor_id e aluno_id não tinham CASCADE
ALTER TABLE public.relatorios
    DROP CONSTRAINT IF EXISTS relatorios_professor_id_fkey,
    DROP CONSTRAINT IF EXISTS relatorios_aluno_id_fkey;

ALTER TABLE public.relatorios
    ADD CONSTRAINT relatorios_professor_id_fkey
        FOREIGN KEY (professor_id) REFERENCES public.usuarios(id) ON DELETE CASCADE,
    ADD CONSTRAINT relatorios_aluno_id_fkey
        FOREIGN KEY (aluno_id)     REFERENCES public.usuarios(id) ON DELETE CASCADE;

-- cronograma: admin_id não tinha CASCADE
ALTER TABLE public.cronograma
    DROP CONSTRAINT IF EXISTS cronograma_admin_id_fkey;

ALTER TABLE public.cronograma
    ALTER COLUMN admin_id DROP NOT NULL,
    ADD CONSTRAINT cronograma_admin_id_fkey
        FOREIGN KEY (admin_id) REFERENCES public.usuarios(id) ON DELETE SET NULL;

-- agenda_meet: created_by não tinha CASCADE
ALTER TABLE public.agenda_meet
    DROP CONSTRAINT IF EXISTS agenda_meet_created_by_fkey;

ALTER TABLE public.agenda_meet
    ADD CONSTRAINT agenda_meet_created_by_fkey
        FOREIGN KEY (created_by) REFERENCES public.usuarios(id) ON DELETE SET NULL;

-- audit_log: usuario_id não tinha CASCADE (já nullable)
ALTER TABLE public.audit_log
    DROP CONSTRAINT IF EXISTS audit_log_usuario_id_fkey;

ALTER TABLE public.audit_log
    ADD CONSTRAINT audit_log_usuario_id_fkey
        FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE SET NULL;
