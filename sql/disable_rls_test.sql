-- TESTE: Desabilitar RLS em todas as tabelas
-- Execute no SQL Editor do Supabase
-- REVERTER depois com enable_rls_restore.sql

ALTER TABLE public.usuarios              DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.alunos_info           DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.professores_info      DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.disponibilidade       DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.agenda_meet           DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.relatorios            DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.cronograma            DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.cronograma_tarefas    DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.atividades            DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro            DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.observacoes_psico     DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log             DISABLE ROW LEVEL SECURITY;
