-- Recria v_professores_completo calculando saldo_aulas_dadas direto de relatorios
-- Execute no SQL Editor do Supabase

CREATE OR REPLACE VIEW public.v_professores_completo AS
SELECT
    u.id,
    u.nome,
    u.email,
    u.ativo,
    u.created_at,
    COALESCE(pi.materia,      '')  AS materia,
    COALESCE(pi.chave_pix,    '')  AS chave_pix,
    COALESCE(pi.link_meet,    '')  AS link_meet,
    (SELECT COUNT(*) FROM public.relatorios r WHERE r.professor_id = u.id) AS saldo_aulas_dadas
FROM public.usuarios u
LEFT JOIN public.professores_info pi ON pi.usuario_id = u.id
WHERE u.role = 'professor';
