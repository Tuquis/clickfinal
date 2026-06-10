-- ============================================================
-- MIGRATION: disciplina_ministrada em relatorios
-- Execute no SQL Editor do Supabase.
-- ============================================================

ALTER TABLE public.relatorios
  ADD COLUMN IF NOT EXISTS disciplina_ministrada TEXT;
