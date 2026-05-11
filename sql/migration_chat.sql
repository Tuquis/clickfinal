-- ============================================================
-- MIGRATION: sistema de chat por aula (mensagens em tempo real)
-- Execute no SQL Editor do Supabase
-- ============================================================

-- Tabela de mensagens
CREATE TABLE IF NOT EXISTS public.mensagens (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  agenda_id     UUID        NOT NULL REFERENCES public.agenda_meet(id) ON DELETE CASCADE,
  remetente_id  UUID        NOT NULL REFERENCES public.usuarios(id),
  conteudo      TEXT        NOT NULL CHECK (char_length(conteudo) BETWEEN 1 AND 2000),
  lida          BOOLEAN     NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mensagens_agenda
  ON public.mensagens (agenda_id, created_at);

-- RLS
ALTER TABLE public.mensagens ENABLE ROW LEVEL SECURITY;

-- SELECT: apenas participantes da aula (professor e aluno) e admin
CREATE POLICY "mensagens_select" ON public.mensagens FOR SELECT
  USING (
    public.get_user_role() = 'admin'
    OR EXISTS (
      SELECT 1 FROM public.agenda_meet am
      WHERE am.id = mensagens.agenda_id
        AND (am.professor_id = public.get_user_id()
          OR am.aluno_id    = public.get_user_id())
    )
  );

-- INSERT: apenas o próprio remetente, sendo participante da aula
CREATE POLICY "mensagens_insert" ON public.mensagens FOR INSERT
  WITH CHECK (
    remetente_id = public.get_user_id()
    AND (
      public.get_user_role() = 'admin'
      OR EXISTS (
        SELECT 1 FROM public.agenda_meet am
        WHERE am.id = mensagens.agenda_id
          AND (am.professor_id = public.get_user_id()
            OR am.aluno_id    = public.get_user_id())
      )
    )
  );

-- UPDATE: apenas para marcar como lida (destinatário)
CREATE POLICY "mensagens_update_lida" ON public.mensagens FOR UPDATE
  USING (
    public.get_user_role() = 'admin'
    OR EXISTS (
      SELECT 1 FROM public.agenda_meet am
      WHERE am.id = mensagens.agenda_id
        AND (am.professor_id = public.get_user_id()
          OR am.aluno_id    = public.get_user_id())
    )
  );

-- Habilita Realtime na tabela
ALTER PUBLICATION supabase_realtime ADD TABLE public.mensagens;
