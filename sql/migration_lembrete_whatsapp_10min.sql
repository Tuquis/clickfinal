-- ============================================================
-- MIGRATION: lembrete_whatsapp_10min_enviado em agenda_meet
-- Execute no SQL Editor do Supabase.
-- ============================================================

ALTER TABLE public.agenda_meet
  ADD COLUMN IF NOT EXISTS lembrete_whatsapp_10min_enviado BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_agenda_lembrete_whatsapp_10min
  ON public.agenda_meet (data, status, lembrete_whatsapp_10min_enviado, horario);
