-- ============================================================
-- MIGRATION: telefone e lembrete_whatsapp_prof_enviado
-- Execute no SQL Editor do Supabase.
-- ============================================================

-- Adiciona telefone do professor em professores_info
ALTER TABLE public.professores_info
  ADD COLUMN IF NOT EXISTS telefone TEXT;

-- Adiciona controle de lembrete WhatsApp para professor em agenda_meet
ALTER TABLE public.agenda_meet
  ADD COLUMN IF NOT EXISTS lembrete_whatsapp_prof_enviado BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_agenda_lembrete_whatsapp_prof
  ON public.agenda_meet (data, status, lembrete_whatsapp_prof_enviado, horario);
