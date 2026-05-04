-- ============================================================
-- MIGRATION: Adicionar link_meet ao perfil do professor
-- Execute no SQL Editor do Supabase
-- ============================================================

ALTER TABLE public.professores_info
    ADD COLUMN IF NOT EXISTS link_meet TEXT;
