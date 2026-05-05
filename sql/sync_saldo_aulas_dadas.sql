-- Sincroniza saldo_aulas_dadas com o número real de relatórios existentes
-- Execute uma vez no SQL Editor do Supabase para corrigir dados históricos

UPDATE public.professores_info pi
SET saldo_aulas_dadas = (
    SELECT COUNT(*)
    FROM public.relatorios r
    WHERE r.professor_id = pi.usuario_id
);
