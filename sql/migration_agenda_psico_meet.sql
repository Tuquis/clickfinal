-- ============================================================
-- MIGRATION: adiciona link_meet na agenda_psico
-- Execute no SQL Editor do Supabase.
-- ============================================================

ALTER TABLE public.agenda_psico
    ADD COLUMN IF NOT EXISTS link_meet TEXT;
