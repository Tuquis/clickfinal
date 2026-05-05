-- ============================================================
-- FIX: RLS professores_info
-- Execute no SQL Editor do Supabase
-- ============================================================

-- 1. Garante que admin vê todas as linhas (SELECT)
DROP POLICY IF EXISTS "professores_info_select" ON public.professores_info;
CREATE POLICY "professores_info_select" ON public.professores_info FOR SELECT
    USING (
        public.get_user_role() = 'admin'
        OR usuario_id = public.get_user_id()
    );

-- 2. Permite que o professor atualize a própria linha (necessário para incrementar saldo)
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

-- 3. Diagnóstico: verifique se os valores estão realmente no banco
-- (copie o resultado e veja se saldo_aulas_dadas está preenchido)
SELECT usuario_id, saldo_aulas_dadas FROM public.professores_info ORDER BY saldo_aulas_dadas DESC;
