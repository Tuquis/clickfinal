-- ============================================================
-- MIGRATION: formulário de consulta da psicopedagoga simplificado —
-- agora ela só precisa preencher "como esse aluno aprende melhor" e
-- anexar um arquivo da consulta. Os campos antigos (anotações,
-- estratégias, humor, engajamento, áreas, recomendações,
-- encaminhamentos) continuam existindo na tabela — consultas antigas
-- não perdem nada — só deixam de ser obrigatórios/coletados no
-- formulário novo.
--
-- Anexo fica num bucket PRIVADO (consultas-psico), igual ao padrão
-- já usado no mural: acesso sempre por signed URL, nunca link
-- público. Só admin e psicopedagoga podem ler.
-- ============================================================

ALTER TABLE public.consultas_psico ALTER COLUMN observacoes DROP NOT NULL;

ALTER TABLE public.consultas_psico ADD COLUMN IF NOT EXISTS anexo_path TEXT;
ALTER TABLE public.consultas_psico ADD COLUMN IF NOT EXISTS anexo_nome TEXT;

-- ── STORAGE ──────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public)
    VALUES ('consultas-psico', 'consultas-psico', false)
    ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "consultas_psico_storage_insert" ON storage.objects;
DROP POLICY IF EXISTS "consultas_psico_storage_select" ON storage.objects;
DROP POLICY IF EXISTS "consultas_psico_storage_delete" ON storage.objects;

-- INSERT: só psicopedagoga, e só dentro da própria pasta ({psico_id}/...)
CREATE POLICY "consultas_psico_storage_insert" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'consultas-psico'
        AND public.get_user_role() = 'psicopedagoga'
        AND (storage.foldername(name))[1] = public.get_user_id()::text
    );

-- SELECT: admin vê tudo; qualquer psicopedagoga vê qualquer anexo
-- (mesma regra já usada pra ler a linha da consulta na tabela)
CREATE POLICY "consultas_psico_storage_select" ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'consultas-psico'
        AND public.get_user_role() IN ('admin', 'psicopedagoga')
    );

-- DELETE: dona do anexo ou admin
CREATE POLICY "consultas_psico_storage_delete" ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'consultas-psico'
        AND (
            (storage.foldername(name))[1] = public.get_user_id()::text
            OR public.get_user_role() = 'admin'
        )
    );
