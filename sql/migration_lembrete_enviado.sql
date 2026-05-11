-- ============================================================
-- MIGRATION: coluna lembrete_enviado em agenda_meet
-- Execute no SQL Editor do Supabase
-- ============================================================

ALTER TABLE public.agenda_meet
  ADD COLUMN IF NOT EXISTS lembrete_enviado BOOLEAN NOT NULL DEFAULT false;

-- Índice para a Edge Function achar as aulas não notificadas rapidamente
CREATE INDEX IF NOT EXISTS idx_agenda_lembrete
  ON public.agenda_meet (data, status, lembrete_enviado, horario);

-- Atualiza a view para incluir o campo
-- lembrete_enviado deve ficar no FINAL para não quebrar a ordem das colunas existentes
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
    al.id   AS aluno_id,
    pr.nome AS professor_nome,
    pr.id   AS professor_id,
    ai.serie,
    ai.disciplina,
    r.id    AS relatorio_id,
    a.lembrete_enviado
FROM public.agenda_meet a
JOIN public.usuarios al ON al.id = a.aluno_id
JOIN public.usuarios pr ON pr.id = a.professor_id
LEFT JOIN public.alunos_info ai ON ai.usuario_id = a.aluno_id
LEFT JOIN public.relatorios   r  ON r.agenda_id  = a.id;
