-- ============================================================
-- RESTAURAR RLS em todas as tabelas
-- Execute no SQL Editor do Supabase
-- ============================================================

-- 1. Reativar RLS em todas as tabelas
ALTER TABLE public.usuarios              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alunos_info           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professores_info      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disponibilidade       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agenda_meet           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.relatorios            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cronograma            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cronograma_tarefas    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atividades            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.observacoes_psico     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log             ENABLE ROW LEVEL SECURITY;

-- 2. Recriar policies de professores_info com a correção (professor pode atualizar própria linha)
DROP POLICY IF EXISTS "professores_info_select" ON public.professores_info;
CREATE POLICY "professores_info_select" ON public.professores_info FOR SELECT
    USING (
        public.get_user_role() = 'admin'
        OR usuario_id = public.get_user_id()
    );

DROP POLICY IF EXISTS "professores_info_insert" ON public.professores_info;
CREATE POLICY "professores_info_insert" ON public.professores_info FOR INSERT
    WITH CHECK (public.get_user_role() = 'admin');

DROP POLICY IF EXISTS "professores_info_update" ON public.professores_info;
CREATE POLICY "professores_info_update" ON public.professores_info FOR UPDATE
    USING (
        public.get_user_role() = 'admin'
        OR usuario_id = public.get_user_id()
    )
    WITH CHECK (
        public.get_user_role() = 'admin'
        OR usuario_id = public.get_user_id()
    );
