-- ============================================================
-- FIX: grants + security definer para v_professores_completo
-- Execute no SQL Editor do Supabase
-- ============================================================

-- 1. Função SECURITY DEFINER que conta relatorios sem restrição de RLS
--    (necessário para que a view retorne o total correto para qualquer role)
CREATE OR REPLACE FUNCTION public.count_relatorios_professor(prof_id UUID)
RETURNS BIGINT LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT COUNT(*) FROM public.relatorios WHERE professor_id = prof_id;
$$;

-- 2. Recriar a view usando a função acima (DROP obrigatório por mudança de colunas)
DROP VIEW IF EXISTS public.v_professores_completo;
CREATE VIEW public.v_professores_completo AS
SELECT
    u.id,
    u.nome,
    u.email,
    u.ativo,
    u.created_at,
    COALESCE(pi.materia,   '') AS materia,
    COALESCE(pi.chave_pix, '') AS chave_pix,
    COALESCE(pi.link_meet, '') AS link_meet,
    public.count_relatorios_professor(u.id) AS saldo_aulas_dadas
FROM public.usuarios u
LEFT JOIN public.professores_info pi ON pi.usuario_id = u.id
WHERE u.role = 'professor';

-- 3. Dar permissão de leitura ao usuário autenticado na view
GRANT SELECT ON public.v_professores_completo TO authenticated;
GRANT SELECT ON public.v_professores_completo TO anon;
