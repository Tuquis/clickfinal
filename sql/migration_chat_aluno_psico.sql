-- Chat aluno <-> psicopedagoga (mesma implementação do chat professor <-> aluno)
-- Execute no SQL Editor do Supabase (ou supabase db query --linked)

-- 1. RLS: aluno passa a poder ver (SELECT) também role='psicopedagoga',
--    além de role='professor' que já tinha. psicopedagoga já enxergava
--    todos os usuarios (IN ('professor','psicopedagoga','mentor')), então
--    não precisa mudar nada pra ela ver os alunos.
DROP POLICY IF EXISTS "usuarios_select" ON public.usuarios;

CREATE POLICY "usuarios_select" ON public.usuarios FOR SELECT
    USING (
        public.get_user_role() = 'admin'
        OR id = public.get_user_id()
        OR public.get_user_role() IN ('professor','psicopedagoga','mentor')
        OR (public.get_user_role() = 'aluno' AND role IN ('professor','psicopedagoga'))
    );

-- 2. RPC de contatos do chat: agora psicopedagoga também entra como
--    "quem o aluno pode ver" e vice-versa (aluno pode ver professor E
--    psicopedagoga; professor/psicopedagoga veem alunos).
DROP FUNCTION IF EXISTS public.get_contatos_chat(TEXT);

CREATE OR REPLACE FUNCTION public.get_contatos_chat(p_role TEXT)
RETURNS TABLE(id UUID, nome TEXT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT u.id, u.nome
    FROM public.usuarios u
    WHERE u.ativo = true
      AND (
            (p_role IN ('professor','psicopedagoga') AND u.role = 'aluno')
            OR (p_role = 'aluno' AND u.role IN ('professor','psicopedagoga'))
          )
    ORDER BY u.nome;
$$;

GRANT EXECUTE ON FUNCTION public.get_contatos_chat(TEXT) TO authenticated;
