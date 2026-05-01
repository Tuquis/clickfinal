-- ============================================================
-- ENSINOCLICK — VIEWS E STORAGE
-- Execute APÓS rls.sql
-- ============================================================

-- ============================================================
-- VIEW: dashboard_stats (admin)
-- ============================================================
CREATE OR REPLACE VIEW public.v_dashboard_stats AS
SELECT
    (SELECT COUNT(*) FROM public.usuarios WHERE role = 'aluno' AND ativo = true) AS total_alunos,
    (SELECT COUNT(*) FROM public.usuarios WHERE role = 'professor' AND ativo = true) AS total_professores,
    (SELECT COUNT(*) FROM public.agenda_meet WHERE data = CURRENT_DATE AND status = 'agendada') AS aulas_hoje,
    (SELECT COALESCE(SUM(valor), 0) FROM public.financeiro WHERE status = 'pago'
        AND DATE_TRUNC('month', pago_em) = DATE_TRUNC('month', NOW())) AS receita_mes,
    (SELECT COUNT(*) FROM public.cronograma_tarefas WHERE status = 'concluida'
        AND DATE_TRUNC('week', concluida_em) = DATE_TRUNC('week', NOW())) AS tarefas_concluidas_semana,
    (SELECT COUNT(*) FROM public.financeiro WHERE status = 'atrasado') AS cobrancas_atrasadas,
    (SELECT COUNT(*) FROM public.relatorios
        WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', NOW())) AS relatorios_mes;

-- ============================================================
-- VIEW: agenda com nomes (join)
-- ============================================================
CREATE OR REPLACE VIEW public.v_agenda_completa AS
SELECT
    a.id,
    a.data,
    a.horario,
    a.conteudo,
    a.link_meet,
    a.status,
    a.created_at,
    al.nome AS aluno_nome,
    al.id AS aluno_id,
    pr.nome AS professor_nome,
    pr.id AS professor_id,
    ai.serie,
    ai.disciplina,
    r.id AS relatorio_id
FROM public.agenda_meet a
JOIN public.usuarios al ON al.id = a.aluno_id
JOIN public.usuarios pr ON pr.id = a.professor_id
LEFT JOIN public.alunos_info ai ON ai.usuario_id = a.aluno_id
LEFT JOIN public.relatorios r ON r.agenda_id = a.id;

-- ============================================================
-- VIEW: alunos com info completa
-- ============================================================
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
    ai.aulas_disponiveis
FROM public.usuarios u
LEFT JOIN public.alunos_info ai ON ai.usuario_id = u.id
WHERE u.role = 'aluno';

-- ============================================================
-- VIEW: professores com saldo
-- ============================================================
CREATE OR REPLACE VIEW public.v_professores_completo AS
SELECT
    u.id,
    u.nome,
    u.email,
    u.ativo,
    u.created_at,
    COALESCE(pi.saldo_aulas_dadas, 0) AS saldo_aulas_dadas
FROM public.usuarios u
LEFT JOIN public.professores_info pi ON pi.usuario_id = u.id
WHERE u.role = 'professor';

-- ============================================================
-- VIEW: financeiro com nome do aluno
-- ============================================================
CREATE OR REPLACE VIEW public.v_financeiro_completo AS
SELECT
    f.id,
    f.descricao,
    f.valor,
    f.vencimento,
    f.status,
    f.pago_em,
    f.created_at,
    u.nome AS aluno_nome,
    u.id AS aluno_id
FROM public.financeiro f
JOIN public.usuarios u ON u.id = f.aluno_id;

-- ============================================================
-- STORAGE BUCKETS (execute como serviço ou via Supabase Dashboard)
-- ============================================================
-- Estes comandos devem ser executados via Supabase Storage API ou Dashboard:
--
-- INSERT INTO storage.buckets (id, name, public) VALUES ('atividades', 'atividades', false);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('evidencias', 'evidencias', false);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('materiais', 'materiais', false);
--
-- Políticas de storage (Storage > Policies no Dashboard):
-- atividades: aluno lê seu próprio; professor escreve para seu aluno; admin total
-- evidencias: aluno escreve/lê o próprio; admin lê todos
-- materiais: professor escreve; aluno lê os seus; admin total
