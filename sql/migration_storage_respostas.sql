-- ============================================================
-- MIGRATION: permite aluno fazer upload de respostas
-- no bucket 'materiais' no caminho respostas/
-- Execute no SQL Editor do Supabase.
-- ============================================================

-- Aluno: pode fazer upload na pasta respostas/
CREATE POLICY "materiais_aluno_resposta_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'materiais'
    AND name LIKE 'respostas/%'
    AND EXISTS (
      SELECT 1 FROM public.usuarios u
      WHERE u.auth_id = auth.uid()
      AND u.role = 'aluno'
    )
  );

-- Aluno: pode ler os próprios arquivos de resposta
CREATE POLICY "materiais_aluno_resposta_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'materiais'
    AND name LIKE 'respostas/%'
  );
