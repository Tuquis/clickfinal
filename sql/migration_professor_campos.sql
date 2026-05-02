-- ============================================================
-- MIGRAÇÃO: Adicionar materia e chave_pix em professores_info
-- Execute este script no Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Adicionar colunas (seguro executar mesmo se já existirem)
ALTER TABLE public.professores_info
    ADD COLUMN IF NOT EXISTS materia   TEXT,
    ADD COLUMN IF NOT EXISTS chave_pix TEXT;

-- 2. Verificar resultado
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'professores_info'
ORDER BY ordinal_position;
