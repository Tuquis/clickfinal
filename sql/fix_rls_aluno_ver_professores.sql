-- FIX: Contatos do chat — aluno vê professores / professor vê alunos
-- Execute no SQL Editor do Supabase (uma única vez)

-- 1. Corrige a política RLS da tabela usuarios
DROP POLICY IF EXISTS "usuarios_select" ON public.usuarios;

CREATE POLICY "usuarios_select" ON public.usuarios FOR SELECT
    USING (
        public.get_user_role() = 'admin'
        OR id = public.get_user_id()
        OR public.get_user_role() IN ('professor','psicopedagoga')
        OR (public.get_user_role() = 'aluno' AND role = 'professor')
    );

-- 2. Função SECURITY DEFINER: retorna contatos do chat sem restrição de RLS
--    (professor → alunos ativos | aluno → professores ativos)
DROP FUNCTION IF EXISTS public.get_contatos_chat(TEXT);

CREATE OR REPLACE FUNCTION public.get_contatos_chat(p_role TEXT)
RETURNS TABLE(id UUID, nome TEXT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT u.id, u.nome
    FROM public.usuarios u
    WHERE u.role = CASE WHEN p_role = 'professor' THEN 'aluno' ELSE 'professor' END
      AND u.ativo = true
    ORDER BY u.nome;
$$;

GRANT EXECUTE ON FUNCTION public.get_contatos_chat(TEXT) TO authenticated;
