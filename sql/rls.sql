-- ============================================================
-- ENSINOCLICK — ROW LEVEL SECURITY (RLS)
-- Execute APÓS schema.sql e triggers.sql
-- ============================================================

-- Ativar RLS em todas as tabelas
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alunos_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professores_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disponibilidade ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agenda_meet ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.relatorios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cronograma ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cronograma_tarefas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atividades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.observacoes_psico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- FUNÇÃO HELPER: obter role do usuário autenticado
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
    SELECT role FROM public.usuarios WHERE auth_id = auth.uid()
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_user_id()
RETURNS UUID AS $$
    SELECT id FROM public.usuarios WHERE auth_id = auth.uid()
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ============================================================
-- POLÍTICAS: usuarios
-- ============================================================
-- Admin vê todos; usuário vê a si mesmo
CREATE POLICY "usuarios_select" ON public.usuarios FOR SELECT
    USING (
        public.get_user_role() = 'admin'
        OR id = public.get_user_id()
        OR public.get_user_role() IN ('professor','psicopedagoga')
    );

CREATE POLICY "usuarios_insert" ON public.usuarios FOR INSERT
    WITH CHECK (public.get_user_role() = 'admin');

CREATE POLICY "usuarios_update" ON public.usuarios FOR UPDATE
    USING (public.get_user_role() = 'admin' OR id = public.get_user_id());

CREATE POLICY "usuarios_delete" ON public.usuarios FOR DELETE
    USING (public.get_user_role() = 'admin');

-- ============================================================
-- POLÍTICAS: alunos_info
-- ============================================================
CREATE POLICY "alunos_info_select" ON public.alunos_info FOR SELECT
    USING (
        public.get_user_role() IN ('admin','professor','psicopedagoga')
        OR usuario_id = public.get_user_id()
    );

CREATE POLICY "alunos_info_insert" ON public.alunos_info FOR INSERT
    WITH CHECK (public.get_user_role() = 'admin');

CREATE POLICY "alunos_info_update" ON public.alunos_info FOR UPDATE
    USING (public.get_user_role() = 'admin');

CREATE POLICY "alunos_info_delete" ON public.alunos_info FOR DELETE
    USING (public.get_user_role() = 'admin');

-- ============================================================
-- POLÍTICAS: professores_info
-- ============================================================
CREATE POLICY "professores_info_select" ON public.professores_info FOR SELECT
    USING (
        public.get_user_role() = 'admin'
        OR usuario_id = public.get_user_id()
    );

CREATE POLICY "professores_info_insert" ON public.professores_info FOR INSERT
    WITH CHECK (public.get_user_role() IN ('admin'));

CREATE POLICY "professores_info_update" ON public.professores_info FOR UPDATE
    USING (public.get_user_role() = 'admin');

-- ============================================================
-- POLÍTICAS: disponibilidade
-- ============================================================
CREATE POLICY "disponibilidade_select" ON public.disponibilidade FOR SELECT
    USING (
        public.get_user_role() IN ('admin','psicopedagoga')
        OR professor_id = public.get_user_id()
    );

CREATE POLICY "disponibilidade_insert" ON public.disponibilidade FOR INSERT
    WITH CHECK (
        public.get_user_role() = 'admin'
        OR (public.get_user_role() = 'professor' AND professor_id = public.get_user_id())
    );

CREATE POLICY "disponibilidade_update" ON public.disponibilidade FOR UPDATE
    USING (
        public.get_user_role() = 'admin'
        OR (public.get_user_role() = 'professor' AND professor_id = public.get_user_id())
    );

CREATE POLICY "disponibilidade_delete" ON public.disponibilidade FOR DELETE
    USING (
        public.get_user_role() = 'admin'
        OR (public.get_user_role() = 'professor' AND professor_id = public.get_user_id())
    );

-- ============================================================
-- POLÍTICAS: agenda_meet
-- ============================================================
CREATE POLICY "agenda_select" ON public.agenda_meet FOR SELECT
    USING (
        public.get_user_role() = 'admin'
        OR professor_id = public.get_user_id()
        OR aluno_id = public.get_user_id()
        OR public.get_user_role() = 'psicopedagoga'
    );

CREATE POLICY "agenda_insert" ON public.agenda_meet FOR INSERT
    WITH CHECK (public.get_user_role() = 'admin');

CREATE POLICY "agenda_update" ON public.agenda_meet FOR UPDATE
    USING (
        public.get_user_role() = 'admin'
        OR professor_id = public.get_user_id()
    );

CREATE POLICY "agenda_delete" ON public.agenda_meet FOR DELETE
    USING (public.get_user_role() = 'admin');

-- ============================================================
-- POLÍTICAS: relatorios
-- ============================================================
CREATE POLICY "relatorios_select" ON public.relatorios FOR SELECT
    USING (
        public.get_user_role() IN ('admin','psicopedagoga')
        OR professor_id = public.get_user_id()
        OR aluno_id = public.get_user_id()
    );

CREATE POLICY "relatorios_insert" ON public.relatorios FOR INSERT
    WITH CHECK (
        public.get_user_role() = 'professor'
        AND professor_id = public.get_user_id()
    );

CREATE POLICY "relatorios_update" ON public.relatorios FOR UPDATE
    USING (
        public.get_user_role() = 'admin'
        OR (public.get_user_role() = 'professor' AND professor_id = public.get_user_id())
    );

-- ============================================================
-- POLÍTICAS: cronograma
-- ============================================================
CREATE POLICY "cronograma_select" ON public.cronograma FOR SELECT
    USING (
        public.get_user_role() IN ('admin','professor','psicopedagoga')
        OR aluno_id = public.get_user_id()
    );

CREATE POLICY "cronograma_insert" ON public.cronograma FOR INSERT
    WITH CHECK (public.get_user_role() = 'admin');

CREATE POLICY "cronograma_update" ON public.cronograma FOR UPDATE
    USING (public.get_user_role() = 'admin');

CREATE POLICY "cronograma_delete" ON public.cronograma FOR DELETE
    USING (public.get_user_role() = 'admin');

-- ============================================================
-- POLÍTICAS: cronograma_tarefas
-- ============================================================
CREATE POLICY "tarefas_select" ON public.cronograma_tarefas FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.cronograma c
            WHERE c.id = cronograma_id
              AND (
                  public.get_user_role() IN ('admin','professor','psicopedagoga')
                  OR c.aluno_id = public.get_user_id()
              )
        )
    );

CREATE POLICY "tarefas_insert" ON public.cronograma_tarefas FOR INSERT
    WITH CHECK (public.get_user_role() = 'admin');

CREATE POLICY "tarefas_update" ON public.cronograma_tarefas FOR UPDATE
    USING (
        public.get_user_role() = 'admin'
        OR EXISTS (
            SELECT 1 FROM public.cronograma c
            WHERE c.id = cronograma_id AND c.aluno_id = public.get_user_id()
        )
    );

-- ============================================================
-- POLÍTICAS: atividades
-- ============================================================
CREATE POLICY "atividades_select" ON public.atividades FOR SELECT
    USING (
        public.get_user_role() = 'admin'
        OR professor_id = public.get_user_id()
        OR aluno_id = public.get_user_id()
    );

CREATE POLICY "atividades_insert" ON public.atividades FOR INSERT
    WITH CHECK (
        public.get_user_role() = 'professor'
        AND professor_id = public.get_user_id()
    );

CREATE POLICY "atividades_update" ON public.atividades FOR UPDATE
    USING (
        public.get_user_role() = 'admin'
        OR (public.get_user_role() = 'professor' AND professor_id = public.get_user_id())
    );

CREATE POLICY "atividades_delete" ON public.atividades FOR DELETE
    USING (
        public.get_user_role() = 'admin'
        OR (public.get_user_role() = 'professor' AND professor_id = public.get_user_id())
    );

-- ============================================================
-- POLÍTICAS: financeiro
-- ============================================================
CREATE POLICY "financeiro_select" ON public.financeiro FOR SELECT
    USING (
        public.get_user_role() = 'admin'
        OR aluno_id = public.get_user_id()
    );

CREATE POLICY "financeiro_insert" ON public.financeiro FOR INSERT
    WITH CHECK (public.get_user_role() = 'admin');

CREATE POLICY "financeiro_update" ON public.financeiro FOR UPDATE
    USING (public.get_user_role() = 'admin');

CREATE POLICY "financeiro_delete" ON public.financeiro FOR DELETE
    USING (public.get_user_role() = 'admin');

-- ============================================================
-- POLÍTICAS: observacoes_psico
-- (aluno NÃO vê — somente admin, psico e professor)
-- ============================================================
CREATE POLICY "observacoes_select" ON public.observacoes_psico FOR SELECT
    USING (
        public.get_user_role() IN ('admin','psicopedagoga','professor')
    );

CREATE POLICY "observacoes_insert" ON public.observacoes_psico FOR INSERT
    WITH CHECK (
        public.get_user_role() = 'psicopedagoga'
        AND psico_id = public.get_user_id()
    );

CREATE POLICY "observacoes_update" ON public.observacoes_psico FOR UPDATE
    USING (
        public.get_user_role() = 'admin'
        OR (public.get_user_role() = 'psicopedagoga' AND psico_id = public.get_user_id())
    );

CREATE POLICY "observacoes_delete" ON public.observacoes_psico FOR DELETE
    USING (
        public.get_user_role() = 'admin'
        OR (public.get_user_role() = 'psicopedagoga' AND psico_id = public.get_user_id())
    );

-- ============================================================
-- POLÍTICAS: audit_log
-- ============================================================
CREATE POLICY "audit_select" ON public.audit_log FOR SELECT
    USING (public.get_user_role() = 'admin');

CREATE POLICY "audit_insert" ON public.audit_log FOR INSERT
    WITH CHECK (true); -- triggers inserem com SECURITY DEFINER
