-- ============================================================
-- MIGRATION: lembrete_manha_data em professores_info
-- Controla que o "bom dia" seja enviado só uma vez por dia.
-- Execute no SQL Editor do Supabase.
-- ============================================================

ALTER TABLE public.professores_info
  ADD COLUMN IF NOT EXISTS lembrete_manha_data DATE;
